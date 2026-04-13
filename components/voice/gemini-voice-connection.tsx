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

  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);

  const isCreditExhausted = duration >= totalAllowedSeconds;

  const {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    connect,
    disconnect,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
  } = useGeminiLive({
    userName: userName || "User",
    voicePreference: voicePreference,
  });

  const isResponding = audioStatus === "playing" || wsStatus === "connecting";

  // Handle Muting logic via the hook directly
  useEffect(() => {
    toggleMicMute(isMuted);
  }, [isMuted, toggleMicMute]);

  useEffect(() => {
    toggleAudioMute(isAudioMuted);
  }, [isAudioMuted, toggleAudioMute]);

  // Duration Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (wsStatus === "open") {
      interval = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;

          // Resilient billing: Save to sessionStorage every 5 seconds
          if (newDuration % 5 === 0 && userId) {
            sessionStorage.setItem(
              "voice_sessionState",
              JSON.stringify({
                userId,
                duration: newDuration,
                voicePreference,
                userName,
                timestamp: Date.now(),
              }),
            );
          }

          return newDuration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [wsStatus, userId, voicePreference, userName]);

  // Fallback billing beacon on unmount/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsStatus === "open" && duration > 0) {
        const payload = {
          userId,
          sessionId: `sess_${Date.now()}`,
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
  }, [wsStatus, duration, userId, getTranscripts, voicePreference, userName]);

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open" || isCreditExhausted)
      return;

    // Reset duration for new call
    setDuration(0);
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
            sessionId: `sess_${Date.now()}`,
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
