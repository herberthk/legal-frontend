"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useGeminiLive } from "@/hooks/use-gemini-live";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants/constants";
import { logAnalyticsEvent } from "@/firebase/client";

interface GeminiVoiceConnectionProps {
  freeVoiceSeconds: number;
  balance: number;
}

const GeminiVoiceConnection: React.FC<GeminiVoiceConnectionProps> = ({
  freeVoiceSeconds,
  balance,
}) => {
  const userName = useAuthStore((state) => state.user?.name);
  const userId = useAuthStore((state) => state.user?.id);
  const voicePreference =
    useAuthStore((state) => state.user?.voicePreference) || "Zephyr";

  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

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
  } = useGeminiLive({
    userId: userId || "",
    userName: userName || "User",
    voicePreference: voicePreference,
  });

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);

  const isCreditExhausted = duration >= totalAllowedSeconds;
  const isResponding = audioStatus === "playing" || wsStatus === "connecting";

  // Handle Muting logic via the hook directly
  useEffect(() => {
    toggleMicMute(isMuted);
  }, [isMuted, toggleMicMute]);

  useEffect(() => {
    toggleAudioMute(isAudioMuted);
  }, [isAudioMuted, toggleAudioMute]);

  // Combined Sync logic for SESSION storage (billing recovery)
  useEffect(() => {
    if (wsStatus === "open" && duration > 0 && duration % 5 === 0 && userId) {
      sessionStorage.setItem(
        "voice_sessionState",
        JSON.stringify({
          userId,
          sessionId,
          duration,
          voicePreference,
          userName,
          timestamp: Date.now(),
        }),
      );
    }
  }, [duration, wsStatus, userId, voicePreference, userName, sessionId]);

  // Fallback billing beacon on unmount/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsStatus === "open" && duration > 0) {
        const payload = {
          userId,
          sessionId,
          duration,
          transcripts: getTranscripts(),
          voicePreference,
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
  }, [wsStatus, duration, userId, getTranscripts, voicePreference, userName, sessionId]);

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open" || isCreditExhausted)
      return;

    // Reset session storage for new call
    sessionStorage.removeItem("voice_sessionState");

    await connect();
    logAnalyticsEvent("voice_call_start", { engine: "gemini_live" });
  }, [connect, wsStatus, isCreditExhausted]);

  const handleEndCall = useCallback(async () => {
    if (wsStatus === "closed" || wsStatus === "idle") return;

    await disconnect();
    logAnalyticsEvent("voice_call_end", { engine: "gemini_live", duration });

    // Final billing submission
    if (duration > 0 && userId) {
      try {
        await fetch("/api/voice-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            sessionId,
            duration,
            transcripts: getTranscripts(),
            voicePreference,
            userName,
          }),
        });
        sessionStorage.removeItem("voice_sessionState");
      } catch (err) {
        console.error("Failed to submit billing", err);
      }
    }
  }, [
    disconnect,
    duration,
    userId,
    getTranscripts,
    voicePreference,
    userName,
    wsStatus,
    sessionId,
  ]);

  useEffect(() => {
    if (isCreditExhausted && wsStatus === "open") {
      handleEndCall();
    }
  }, [isCreditExhausted, wsStatus, handleEndCall]);

  return (
    <VoiceInterface
      wsStatus={wsStatus}
      audioStatus={audioStatus}
      duration={duration}
      remainingSeconds={remainingSeconds}
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
      voiceName={voicePreference}
      freeVoiceSeconds={freeVoiceSeconds}
      isCreditExhausted={isCreditExhausted}
    />
  );
};

export default GeminiVoiceConnection;
