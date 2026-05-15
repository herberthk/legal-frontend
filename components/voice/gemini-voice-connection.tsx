"use client";

import React, {
  useState,
  useEffect,
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
import { sendSingleNotification } from "@/lib";

interface GeminiVoiceConnectionProps {
  freeVoiceSeconds: number;
  balance: number;
}

const GeminiVoiceConnection: React.FC<GeminiVoiceConnectionProps> = ({
  freeVoiceSeconds,
  balance,
}) => {
  // Only take first name of the user in AI actions
  const userName = useAuthStore((state) => state.user?.name)?.split(" ")[0];
  const userId = useAuthStore((state) => state.user?.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preferedVoice = useAuthStore((state) => state.user?.preferedVoice) || {
    preferedVoiceId: "Aoede",
    preferedVoiceName: "Evelyn",
  };

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
  } = useConversationRecorder();

  // Stable ref to avoid circular dependencies with the hook
  const handleEndCallRef = useRef<() => Promise<void>>(null);

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);

  const {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    duration,
    remainingSeconds,
    sessionId,
    connect,
    disconnect,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
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
    totalAllowedSeconds,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const isCreditExhausted = duration >= totalAllowedSeconds;

  const isResponding = audioStatus === "playing" || wsStatus === "connecting";

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

  // ── Audio Feedback ────────────────────────────────────────────────────────────
  const connectingAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const disconnectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxCtxRef = useRef<AudioContext | null>(null);

  // Preload audio files and route through Web Audio API for volume boost.
  // HTMLAudioElement.volume caps at 1.0 — to go louder we pipe each element
  // through a GainNode at 2.0× (~+6dB).
  useEffect(() => {
    const BOOST = 2.0; // +6dB over system level

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
      connectedAudioRef.current?.play().catch((err) => {
        console.warn("Connected sound playback failed:", err);
      });
    }

    if (wsStatus === "closed") {
      disconnectedAudioRef.current?.play().catch((err) => {
        console.warn("Disconnected sound playback failed:", err);
      });
    }
  }, [wsStatus]);

  // Handle Muting logic via the hook directly
  useEffect(() => {
    toggleMicMute(isMuted);
  }, [isMuted, toggleMicMute]);

  useEffect(() => {
    toggleAudioMute(isAudioMuted);
  }, [isAudioMuted, toggleAudioMute]);

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

  // Fallback billing beacon on unmount/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsStatus === "open" && duration > 0) {
        // Snapshot with .slice() for the same reason as handleEndCall:
        // prevents a concurrent buffer-sync from mutating the array after we
        // hand it to JSON.stringify inside the Blob constructor.
        const payload = {
          userId,
          sessionId,
          duration,
          transcripts: getTranscripts().slice(),
          preferedVoice,
          userName,
        };
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/voice-billing", blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    wsStatus,
    duration,
    userId,
    getTranscripts,
    preferedVoice,
    userName,
    sessionId,
  ]);

  // ── Connection error classifier ──────────────────────────────────────────
  // Maps a raw error (or undefined for timeout/offline) to a ConnectionErrorKind.
  const classifyConnectionError = useCallback(
    (err?: unknown): { kind: ConnectionErrorKind; rawMessage?: string } => {
      // Check offline first — most reliable signal
      if (!navigator.onLine) {
        return { kind: "offline" };
      }

      const message = err instanceof Error ? err.message : String(err ?? "");
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
    },
    [],
  );

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

    // Reset duration for new call
    sessionStorage.removeItem("voice_sessionState");

    // Initialize the recorder for this session BEFORE connecting so the
    // worker's IDB is open and ready to accept the very first audio chunks
    // that arrive milliseconds after the WebSocket handshake.
    startSession(sessionId);

    // ── Connection timeout ─────────────────────────────────────────────────
    // If wsStatus never transitions away from "connecting" within 15 s,
    // we abort and surface a timeout error. The hook's catch block will also
    // fire setWsStatus("error") eventually, but this covers the case where
    // the SDK hangs without throwing (e.g. DNS resolution timeout).
    connectTimeoutRef.current = setTimeout(() => {
      // Only fire if we're STILL in the connecting phase
      if (wsStatusRef.current === "connecting") {
        setConnectionError({ kind: "timeout" });
        // Attempt a clean disconnect — ignore failures
        disconnect().catch(() => {});
      }
    }, 15_000);

    try {
      await connect();
      logAnalyticsEvent("voice_call_start", { engine: "gemini_live" });
    } catch (err) {
      setConnectionError(classifyConnectionError(err));
    } finally {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
    }
  }, [
    connect,
    disconnect,
    wsStatus,
    isCreditExhausted,
    startSession,
    sessionId,
    classifyConnectionError,
  ]);

  // Ref mirror of wsStatus so the timeout callback can read it without
  // becoming a stale closure (avoids having wsStatus in its dep array).
  const wsStatusRef = useRef(wsStatus);
  useEffect(() => {
    wsStatusRef.current = wsStatus;
    // When the connection succeeds, clear any pending timeout
    if (wsStatus === "open" && connectTimeoutRef.current) {
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

        // Step 1: Encode WAV
        setPostCallStage("encoding");
        const blob = await finalizeRecording();

        // Step 2: Finalize billing and create session record
        setPostCallStage("billing");
        const res = await fetch("/api/voice-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            sessionId,
            duration,
            transcripts: capturedTranscripts,
            preferedVoice,
            userName,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.voiceSessionId) {
          throw new Error(data.error || "Failed to finalize session details");
        }

        sessionStorage.removeItem("voice_sessionState");
        const voiceSessionId = data.voiceSessionId;

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
          title: "Your AI Legal voice Session is Available",
          message: `Your AI legal consultation session that lasted for (${durationLabel}) is now available.`,
          link: `/dashboard/user/transcripts/${voiceSessionId}`,
        }).catch((err) =>
          console.error("[FCM] Post-call push notification failed:", err),
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error("Post call processing failed", err);
        setPostCallError(err.message || "An unexpected error occurred.");
        setPostCallStage("error");
        setTimeout(() => setPostCallStage(null), 5000);
      }
    } else {
      // Just clear the worker if no duration
      finalizeRecording().catch(() => {});
    }
  }, [
    disconnect,
    duration,
    userId,
    getTranscripts,
    preferedVoice,
    userName,
    wsStatus,
    sessionId,
    finalizeRecording,
  ]);

  // Update the ref whenever the callback changes to ensure useGeminiLive
  // always has access to the latest version for the 30-min timeout.
  handleEndCallRef.current = handleEndCall;

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
