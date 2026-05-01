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
import type { PostCallStage } from "./PostCallProgress";

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
    preferedVoiceId: "Zephyr",
    preferedVoiceName: "Hana",
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
  });

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);
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

  // ── Audio Feedback ────────────────────────────────────────────────────────────
  const connectingAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const disconnectedAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload audio files
  useEffect(() => {
    connectingAudioRef.current = new Audio("/voices/connecting.mp3");
    connectingAudioRef.current.loop = true;
    connectedAudioRef.current = new Audio("/voices/connected.mp3");
    disconnectedAudioRef.current = new Audio("/voices/disconnected.mp3");
    connectingAudioRef.current.volume = 1.0;
    connectedAudioRef.current.volume = 1.0;
    disconnectedAudioRef.current.volume = 1.0;

    return () => {
      connectingAudioRef.current?.pause();
      connectedAudioRef.current?.pause();
      disconnectedAudioRef.current?.pause();
      connectingAudioRef.current = null;
      connectedAudioRef.current = null;
      disconnectedAudioRef.current = null;
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

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open" || isCreditExhausted)
      return;

    // Reset duration for new call
    sessionStorage.removeItem("voice_sessionState");

    // Initialize the recorder for this session BEFORE connecting so the
    // worker's IDB is open and ready to accept the very first audio chunks
    // that arrive milliseconds after the WebSocket handshake.
    startSession(sessionId);

    await connect();
    logAnalyticsEvent("voice_call_start", { engine: "gemini_live" });
  }, [connect, wsStatus, isCreditExhausted, startSession, sessionId]);

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
    />
  );
};

export default GeminiVoiceConnection;
