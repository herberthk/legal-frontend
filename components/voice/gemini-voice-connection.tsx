"use client";

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useConversationRecorder } from "@/hooks/use-conversation-recorder";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants/constants";
import { logAnalyticsEvent } from "@/firebase/client";
import { sendSingleNotification } from "@/lib/actions/pushNotification";

interface GeminiVoiceConnectionProps {
  freeVoiceSeconds: number;
  balance: number;
}

const DEFAULT_VOICE_PREFERENCE: PreferedVoice = {
  preferedVoiceId: "Aoede",
  preferedVoiceName: "Evelyn",
};

// Connecting is timed in two halves, because only one of them is ours to rush.
// Claiming the mic can block on a permission dialog for as long as the user
// takes to read it; everything after it — ephemeral token, socket handshake —
// is network work that should land in seconds. A single budget covering both
// has to be generous enough for the dialog, which leaves it too slack to catch
// a hang. So: a loose ceiling until the mic is live, then a strict one.
const MIC_GRANT_TIMEOUT_MS = 60_000;
const CONNECT_TIMEOUT_MS = 60_000;

// ── Connection error classifier ──────────────────────────────────────────
// Maps a raw error (or undefined for timeout/offline) to a ConnectionErrorKind.
function classifyConnectionError(
  err?: unknown,
): { kind: ConnectionErrorKind; rawMessage?: string } {
  // Check offline first — most reliable signal
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { kind: "offline" };
  }

  let message = err instanceof Error ? err.message : String(err ?? "");
  if (message === "[object Event]" || !message) {
    message = "WebSocket connection error. Network connection dropped or refused.";
  }
  const name = err instanceof Error ? err.name : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /not allowed|permission denied|microphone.*blocked/i.test(message)
  ) {
    return { kind: "mic_denied", rawMessage: message };
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    /not found|no.*microphone|device.*not found/i.test(message)
  ) {
    return { kind: "mic_unavailable", rawMessage: message };
  }

  if (/token|auth|401|403|forbidden|unauthorized/i.test(message)) {
    return { kind: "token_failed", rawMessage: message };
  }

  return { kind: "generic", rawMessage: message || undefined };
}

const GeminiVoiceConnection: React.FC<GeminiVoiceConnectionProps> = ({
  freeVoiceSeconds,
  balance,
}) => {
  // Only take first name of the user in AI actions
  const userName = useAuthStore((state) => state.user?.name)?.split(" ")[0];
  const userId = useAuthStore((state) => state.user?.id);
  const preferedVoice =
    useAuthStore((state) => state.user?.preferedVoice) ||
    DEFAULT_VOICE_PREFERENCE;

  // ── Conversation Recorder ────────────────────────────────────────────────────
  // The recorder hook spawns a persistent Worker backed by IndexedDB.
  // Audio chunks are routed here from useGeminiLive via the onUserAudioChunk
  // / onAIAudioChunk callbacks below.
  const {
    startSession,
    addUserChunk,
    addAIChunk,
    finalizeRecording,
    encodingProgress,
    cleanup,
  } = useConversationRecorder();

  // Stable ref to avoid circular dependencies with the hook
  const handleEndCallRef = useRef<() => Promise<void>>(null);
  const armConnectTimeoutRef = useRef<((ms: number) => void) | null>(null);

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);

  const {
    wsStatus,
    audioStatus,
    isListening,
    isProcessing,
    activeTranscript,
    duration,
    remainingSeconds,
    sessionId,
    connect,
    disconnect,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
    prefetchToken,
    micLevel,
    aiAudioLevel,
  } = useGeminiLive({
    userId: userId || "",
    userName: userName || "User",
    preferedVoice,
    // Forward audio chunks to the recorder worker.
    // These callbacks are stable refs in the hook so they never trigger
    // connectToGemini to rebuild its internal closure.
    onUserAudioChunk: addUserChunk,
    onAIAudioChunk: addAIChunk,
    onDurationLimitReached: useCallback(() => {
      handleEndCallRef.current?.();
    }, []),
    // The hook mints the session id, so it also opens the recorder for it. Doing
    // this here rather than before connect() guarantees the recorder and the
    // billing path are keyed to the same session.
    onSessionStart: startSession,
    // The permission dialog is behind us, so tighten the connect budget onto
    // the network work that is left.
    onMicReady: useCallback(() => {
      armConnectTimeoutRef.current?.(CONNECT_TIMEOUT_MS);
    }, []),
    onError: useCallback((err: unknown) => {
      setConnectionError(classifyConnectionError(err));
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    }, []),
    totalAllowedSeconds,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const isCreditExhausted = duration >= totalAllowedSeconds;

  const isResponding =
    isProcessing || audioStatus === "playing" || wsStatus === "connecting";

  // Post-call UI State
  const [postCallStage, setPostCallStage] = useState<PostCallStage | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postCallError, setPostCallError] = useState<string | undefined>();

  // ── Connection Error State ────────────────────────────────────────────────
  // Typed error surfaced when wsStatus fails to reach "open". Distinct from
  // postCallError which covers post-session processing failures.
  const [connectionError, setConnectionError] = useState<{
    kind: ConnectionErrorKind;
    rawMessage?: string;
  } | null>(null);

  // Ref to the connection-timeout timer so we can clear it on success
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True once the server has confirmed billing for the current session. The
  // unload beacon reads this to decide whether the seconds are still unbilled;
  // a ref (not state) because the unload handler must see the current value
  // without the effect re-subscribing on every change.
  const billingSettledRef = useRef(false);
  const lastBeaconRef = useRef<{ sessionId: string; duration: number } | null>(
    null,
  );

  // ── Audio Feedback ────────────────────────────────────────────────────────────
  const connectingAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const disconnectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxCtxRef = useRef<AudioContext | null>(null);

  // Preload audio files and route through Web Audio API for subtle cue boost.
  // Keeping gain moderate (1.05x) avoids blasting the connected chime into the
  // open microphone right as the session starts.
  useEffect(() => {
    const BOOST = 1.05;

    const SfxAudioCtx =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    const sfxCtx = new SfxAudioCtx();
    sfxCtxRef.current = sfxCtx;

    const boostAudio = (audio: HTMLAudioElement) => {
      const source = sfxCtx.createMediaElementSource(audio);
      const gain = sfxCtx.createGain();
      gain.gain.value = BOOST;
      source.connect(gain);
      gain.connect(sfxCtx.destination);
    };

    connectingAudioRef.current = new Audio("/voices/connecting.mp3");
    connectingAudioRef.current.loop = true;
    connectedAudioRef.current = new Audio("/voices/connected.mp3");
    disconnectedAudioRef.current = new Audio("/voices/disconnected.mp3");

    boostAudio(connectingAudioRef.current);
    boostAudio(connectedAudioRef.current);
    boostAudio(disconnectedAudioRef.current);

    return () => {
      connectingAudioRef.current?.pause();
      connectedAudioRef.current?.pause();
      disconnectedAudioRef.current?.pause();
      connectingAudioRef.current = null;
      connectedAudioRef.current = null;
      disconnectedAudioRef.current = null;
      sfxCtx.close().catch(() => {});
      sfxCtxRef.current = null;
    };
  }, []);

  // Handle Audio Playback based on wsStatus
  useEffect(() => {
    if (wsStatus === "connecting") {
      connectingAudioRef.current?.play().catch((err) => {
        console.warn("Connecting sound playback failed:", err);
      });
    } else {
      connectingAudioRef.current?.pause();
      if (connectingAudioRef.current) {
        connectingAudioRef.current.currentTime = 0;
      }
    }

    if (wsStatus === "open") {
      // Only play connected sound if we didn't just surface a connection error (like timeout)
      if (!connectionError) {
        connectedAudioRef.current?.play().catch((err) => {
          console.warn("Connected sound playback failed:", err);
        });
      }
    }

    if (wsStatus === "closed") {
      disconnectedAudioRef.current?.play().catch((err) => {
        console.warn("Disconnected sound playback failed:", err);
      });
    }
  }, [connectionError, wsStatus]);

  // Handle Muting logic via the hook directly
  useEffect(() => {
    toggleMicMute(isMuted);
  }, [isMuted, toggleMicMute]);

  useEffect(() => {
    toggleAudioMute(isAudioMuted);
  }, [isAudioMuted, toggleAudioMute]);

  // Prefetch ephemeral token on mount so that when the user taps start, the token is already in memory
  useEffect(() => {
    if (userId && !isCreditExhausted && wsStatus === "idle") {
      prefetchToken();
    }
  }, [userId, isCreditExhausted, wsStatus, prefetchToken]);

  // Duration Timer
  useEffect(() => {
    if (wsStatus === "open" && duration > 0 && duration % 5 === 0 && userId) {
      sessionStorage.setItem(
        "voice_sessionState",
        JSON.stringify({
          userId,
          sessionId,
          duration,
          preferedVoice,
          userName,
          timestamp: Date.now(),
        }),
      );
    }
  }, [wsStatus, userId, preferedVoice, userName, duration, sessionId]);

  // ── Fallback billing beacon ──────────────────────────────────────────────
  // The values the beacon needs, refreshed on every render. Keeping them in a
  // ref is what lets the listeners register once: `duration` changes every
  // second, so putting it in the effect's deps tore both listeners down and
  // re-added them ~1800 times in a 30-minute call, and each removal opened a
  // window where an unload would have found nothing listening.
  const beaconPayloadRef = useRef({
    sessionId,
    duration,
    getTranscripts,
    userId,
  });

  // Committed after the render lands, never assigned during it. React is free to
  // start a render, throw it away and re-render with different values — under
  // the React Compiler and concurrent rendering that is a normal occurrence, not
  // an edge case — and a ref written from a discarded pass keeps a payload the
  // UI never adopted. Here that means the beacon bills a duration or a sessionId
  // that never existed.
  //
  // useLayoutEffect, not useEffect: it runs synchronously at commit, so there is
  // no interval in which an unload could read the previous second's payload.
  useLayoutEffect(() => {
    beaconPayloadRef.current = {
      sessionId,
      duration,
      getTranscripts,
      userId,
    };
  }, [sessionId, duration, getTranscripts, userId]);

  // Fires when the page goes away while seconds are still unbilled.
  //
  // Deliberately NOT gated on wsStatus: disconnect() flips it to "idle" before
  // finalization begins, so gating there meant that closing the tab during the
  // encode/upload window sent nothing at all — no billing, no session record.
  // That window is precisely when the fallback matters most, so the gate is
  // "has billing confirmed yet", not "is the socket open".
  //
  // Safe to fire redundantly: /api/voice-billing is idempotent and bills only
  // seconds nobody has billed yet, so an overlap with the normal path, or with
  // the scheduler's sweep of abandoned buffers, cannot double-charge.
  useEffect(() => {
    const sendFallbackBeacon = () => {
      const current = beaconPayloadRef.current;
      if (billingSettledRef.current || current.duration <= 0 || !current.userId)
        return;
      if (
        lastBeaconRef.current?.sessionId === current.sessionId &&
        lastBeaconRef.current?.duration === current.duration
      ) {
        return;
      }

      // Snapshot with .slice() for the same reason as handleEndCall:
      // prevents a concurrent buffer-sync from mutating the array after we
      // hand it to JSON.stringify inside the Blob constructor.
      const payload = {
        sessionId: current.sessionId,
        duration: current.duration,
        transcripts: current.getTranscripts().slice(),
      };
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      if (
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon("/api/voice-billing", blob)
      ) {
        lastBeaconRef.current = {
          sessionId: current.sessionId,
          duration: current.duration,
        };
      }
    };

    const resetBeaconDedup = () => {
      lastBeaconRef.current = null;
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastBeaconRef.current = null;
      }
    };

    // pagehide is the one that actually fires on mobile when the user switches
    // apps or the tab is discarded; beforeunload is unreliable there.
    window.addEventListener("pagehide", sendFallbackBeacon);
    window.addEventListener("beforeunload", sendFallbackBeacon);
    // Re-arm dedup when the user returns to the page so an unconfirmed beacon
    // from an earlier exit cannot suppress a later exit before the next tick.
    window.addEventListener("pageshow", resetBeaconDedup);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", sendFallbackBeacon);
      window.removeEventListener("beforeunload", sendFallbackBeacon);
      window.removeEventListener("pageshow", resetBeaconDedup);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Also flush unbilled seconds on SPA route navigation unmount.
      sendFallbackBeacon();
    };
  }, []);

  // ── Connection timeout ─────────────────────────────────────────────────────
  // If wsStatus never transitions away from "connecting" within the current
  // budget, we abort and surface a timeout error. The hook's catch block will
  // also fire setWsStatus("error") eventually, but this covers the case where
  // the SDK hangs without throwing (e.g. DNS resolution timeout).
  //
  // Re-armable, because the budget tightens once the mic is live (onMicReady).
  // Clearing first is what makes that safe: overwriting the ref would orphan
  // the previous timer, and an orphaned timer disconnects the attempt that
  // replaced it — closing the AudioContext while its worklets are still
  // loading, which is exactly the InvalidStateError/AbortError pair.
  const armConnectTimeout = useCallback(
    (ms: number) => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        // Only fire if we're STILL in the connecting phase
        if (wsStatusRef.current === "connecting") {
          setConnectionError({ kind: "timeout" });
          // Attempt a clean disconnect — ignore failures
          disconnect().catch(() => {});
        }
      }, ms);
    },
    [disconnect],
  );

  useLayoutEffect(() => {
    armConnectTimeoutRef.current = armConnectTimeout;
  }, [armConnectTimeout]);

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open" || isCreditExhausted)
      return;

    // Immediately fail with offline error — don't even try to connect
    if (!navigator.onLine) {
      setConnectionError({ kind: "offline" });
      return;
    }

    // Clear any stale error
    setConnectionError(null);

    // The SFX context is built on mount, with no user gesture behind it, so
    // Firefox starts it suspended — and because every cue is routed through
    // createMediaElementSource, a suspended context means silence rather than
    // direct element playback. This click is the gesture, so resume here.
    // Not awaited: Firefox leaves resume() pending (never rejected) while a
    // context is still blocked, so awaiting it could stall the connect path.
    const sfxCtx = sfxCtxRef.current;
    if (sfxCtx && sfxCtx.state === "suspended") {
      sfxCtx.resume().catch(() => {});
    }

    // Reset duration for new call
    sessionStorage.removeItem("voice_sessionState");

    // New call, new unbilled seconds — re-arm the unload beacon and reset mute
    // toggles synchronously so connect() claims hardware unmuted.
    billingSettledRef.current = false;
    lastBeaconRef.current = null;
    setIsMuted(false);
    setIsAudioMuted(false);
    toggleMicMute(false);
    toggleAudioMute(false);

    // The recorder is started from the hook's onSessionStart, which fires with
    // the id of the call being opened. Starting it here instead would hand it
    // the *previous* session's id: connect() mints the new one, so the id in
    // scope right now is one call behind, and every chunk would be filed under
    // a session that billing and cleanup never look at.

    // Loose ceiling for now: claimMicStream may be sitting on a permission
    // dialog, and aborting a call because the user reads slowly is wrong. The
    // hook's onMicReady tightens this to CONNECT_TIMEOUT_MS the moment the mic
    // is live. The ceiling still stands if that never happens — getUserMedia
    // can hang without ever resolving or rejecting.
    armConnectTimeout(MIC_GRANT_TIMEOUT_MS);

    try {
      await connect();
      logAnalyticsEvent("voice_call_start", { engine: "gemini_live" });
      // Deliberately leave the timeout armed here. connect() resolves once the
      // SDK hands back a session, which is BEFORE onopen fires — so clearing it
      // now would let a session that never opens sit on "connecting" forever
      // with no error. The wsStatus effect clears it when we reach "open".
    } catch (err) {
      setConnectionError(classifyConnectionError(err));
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      disconnect().catch(() => {});
    }
  }, [
    connect,
    armConnectTimeout,
    wsStatus,
    isCreditExhausted,
    disconnect,
    toggleMicMute,
    toggleAudioMute,
  ]);

  // Ref mirror of wsStatus so the timeout callback can read it without
  // becoming a stale closure (avoids having wsStatus in its dep array).
  const wsStatusRef = useRef(wsStatus);
  useEffect(() => {
    wsStatusRef.current = wsStatus;
    // Clear the pending timeout once we leave the connecting phase for good —
    // on success, or on a terminal state that already surfaces its own error.
    if (
      (wsStatus === "open" || wsStatus === "error" || wsStatus === "closed") &&
      connectTimeoutRef.current
    ) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    // When the hook itself transitions to "error", classify and surface it
    if (wsStatus === "error" && !connectionError) {
      setConnectionError({ kind: "generic" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, []);

  const handleClearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const handleEndCall = useCallback(async () => {
    if (wsStatus === "closed" || wsStatus === "idle") return;

    // Snapshot transcripts BEFORE disconnecting.
    const capturedTranscripts = getTranscripts().slice();

    await disconnect();
    logAnalyticsEvent("voice_call_end", { engine: "gemini_live", duration });

    if (duration > 0 && userId) {
      try {
        setPostCallError(undefined);

        // Step 1: Finalize billing and create the session record.
        //
        // Billing runs FIRST, before the slow encode. Everything the record
        // needs — duration, transcripts, summary — is already in hand, while
        // encoding takes seconds and uploading takes longer still. Doing money
        // and transcript first means a tab closed mid-encode still leaves a
        // complete, correctly billed session; only the audio is missing, and
        // the PCM stays in IDB for a later pass to pick up.
        setPostCallStage("billing");
        const res = await fetch("/api/voice-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            duration,
            transcripts: capturedTranscripts,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.voiceSessionId) {
          throw new Error(data.error || "Failed to finalize session details");
        }

        // Server has the seconds — the unload beacon must not re-send them.
        billingSettledRef.current = true;
        sessionStorage.removeItem("voice_sessionState");
        const voiceSessionId = data.voiceSessionId;

        // Step 2: Encode WebM
        setPostCallStage("encoding");
        const blob = await finalizeRecording();

        // Step 3: Upload to Firebase Storage
        setPostCallStage("uploading");
        const { storage } = await import("@/firebase/client");
        const { ref, uploadBytesResumable, getDownloadURL } =
          await import("firebase/storage");
        const { BUCKETS } = await import("@/constants/buckets");

        const fileName = `${userId}_${sessionId}.webm`;
        const storageRef = ref(
          storage,
          `${BUCKETS.STORED_FILES}/voice-sessions/${fileName}`,
        );
        const uploadTask = uploadBytesResumable(storageRef, blob);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => reject(error),
            () => resolve(),
          );
        });

        const downloadURL = await getDownloadURL(storageRef);

        // Step 4: Update Firestore with audioUrl
        setPostCallStage("saving");
        const { db } = await import("@/firebase/client");
        const { doc, updateDoc } = await import("firebase/firestore");
        const { COLLECTIONS } = await import("@/constants/collection");

        const sessionRef = doc(db, COLLECTIONS.VOICE_SESSIONS, voiceSessionId);
        await updateDoc(sessionRef, { audioUrl: downloadURL });

        // The audio is now safely in Storage and linked from the session doc,
        // so the stored PCM is finally redundant. This is the only place that
        // releases it on the happy path — the recorder no longer deletes chunks
        // after encoding, because until this point they are the only copy.
        cleanup(sessionId);

        // Step 5: Done
        setPostCallStage("done");
        setTimeout(() => setPostCallStage(null), 3000);

        // ── Push notification — fire-and-forget ─────────────────────────────────
        const durationMin = Math.floor(duration / 60);
        const durationSec = duration % 60;
        const durationLabel =
          durationMin > 0
            ? `${durationMin}m ${durationSec}s`
            : `${durationSec}s`;

        sendSingleNotification({
          to: userId,
          title: "Your AI voice Session is Available",
          message: `Your AI legal consultation session that lasted for (${durationLabel}) is now available.`,
          link: `/dashboard/transcripts/${voiceSessionId}`,
        }).catch((err) =>
          console.error("[FCM] Post-call push notification failed:", err),
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("Post call processing failed", err);
        setPostCallError(err.message || "An unexpected error occurred.");
        setPostCallStage("error");
        setTimeout(() => setPostCallStage(null), 5000);
        // Deliberately no cleanup() here: a failure after billing means the
        // audio never made it to Storage, and its chunks are the only copy.
        // They are kept for a later recovery pass and reclaimed by the
        // recorder's age-based prune if nothing ever claims them.
      }
    } else {
      // Nothing was recorded worth keeping — release the chunks outright
      // rather than paying to encode a blob no one will upload.
      cleanup(sessionId);
    }
  }, [
    disconnect,
    duration,
    userId,
    getTranscripts,
    wsStatus,
    sessionId,
    finalizeRecording,
    cleanup,
  ]);

  // Update the ref whenever the callback changes to ensure useGeminiLive
  // always has access to the latest version for the 30-min timeout.
  //
  // Same rule as beaconPayloadRef: committed in a layout effect so a render that
  // React discards can never leave the timeout holding a callback closed over
  // state the component never actually rendered with.
  useLayoutEffect(() => {
    handleEndCallRef.current = handleEndCall;
  }, [handleEndCall]);

  useEffect(() => {
    if (isCreditExhausted && wsStatus === "open") {
      handleEndCall();
    }
  }, [isCreditExhausted, wsStatus, handleEndCall]);

  return (
    <VoiceInterface
      wsStatus={wsStatus}
      remainingSeconds={remainingSeconds}
      audioStatus={audioStatus}
      duration={duration}
      isResponding={isResponding}
      activeTranscript={activeTranscript}
      onStart={handleStartCall}
      onEnd={handleEndCall}
      isMuted={isMuted}
      setIsMuted={setIsMuted}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      userName={userName}
      listening={isListening}
      voiceName={preferedVoice.preferedVoiceName}
      freeVoiceSeconds={freeVoiceSeconds}
      isCreditExhausted={isCreditExhausted}
      postCallStage={postCallStage}
      postCallError={postCallError}
      encodingProgress={encodingProgress}
      uploadProgress={uploadProgress}
      micLevel={micLevel}
      aiAudioLevel={aiAudioLevel}
      connectionError={connectionError}
      onClearConnectionError={handleClearConnectionError}
    />
  );
};

export default GeminiVoiceConnection;
