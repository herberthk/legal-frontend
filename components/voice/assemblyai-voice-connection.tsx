"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react"; // Added useMemo
import { useVoiceSession, useAssemblyAITranscription } from "@/hooks";
import { useAppStore, useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";

const AssemblyAIVoiceConnection = () => {
  const userName = useAuthStore((state) => state.user?.name); // Refined store subscription
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const voice = useAppStore((state) => state.preferredVoice);
  const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(
    null,
  );

  // llmText state removed
  const [isResponding, setIsResponding] = useState(false);

  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url: `ws://localhost:8000?voice=${voice}`,
    onText: (delta) => {
      setActiveTranscript((prev) => {
        const nextText = (prev?.speaker === "ai" ? prev.text : "") + delta;
        return {
          speaker: "ai",
          text: nextText,
        };
      });
    },
    onInterrupt: () => {
      setIsResponding(false);
      reset();
    },
    onAudioDone: () => {
      setIsResponding(false);
    },
    onError: (msg) => {
      setIsResponding(false);
      reset();
      setActiveTranscript({
        speaker: "system",
        text: `Error: ${msg}`,
      });
    },
    onDuration: (d) => setDuration(d),
    isAudioMuted,
  });

  const {
    transcript: aiTranscript,
    isRecording: aiIsRecording,
    start: startAiStt,
    stop: stopAiStt,
    isConnecting: isSttConnecting,
    error: transcriptError,
    reset,
  } = useAssemblyAITranscription({
    onTurnEnd: useCallback(
      (text: string) => {
        // Stabilized handleTurnEnd
        setIsResponding(true);
        setActiveTranscript({
          speaker: "user",
          text: text,
        });
        send(text);
        reset();
      },
      [send],
    ), // Dependencies for useCallback
    onError: (err) => console.error("[stt]", err),
  });

  const computedWsStatus: VoiceSessionStatus = useMemo(() => {
    // Memoized status
    if (wsStatus === "error" || transcriptError) return "error";
    if (wsStatus === "open" && (aiIsRecording || isMuted)) return "open";
    if (wsStatus === "connecting" || isSttConnecting) return "connecting";
    return wsStatus;
  }, [wsStatus, transcriptError, aiIsRecording, isMuted, isSttConnecting]);

  useEffect(() => {
    if (wsStatus === "open") {
      setActiveTranscript({
        speaker: "system",
        text: "Getting things ready...",
      });
    }
  }, [wsStatus]);

  useEffect(() => {
    if (transcriptError) {
      setActiveTranscript({
        speaker: "system",
        text: `Transcription Error: ${transcriptError}`,
      });
    }
  }, [transcriptError]);

  // llmText useEffect removed

  const handleStartCall = useCallback(async () => {
    // Stabilized handleStartCall
    if (
      wsStatus === "connecting" ||
      wsStatus === "open" ||
      aiIsRecording ||
      isSttConnecting
    )
      return;
    await startAiStt();
    connect();
  }, [wsStatus, aiIsRecording, isSttConnecting, startAiStt, connect]);

  const handleEndCall = useCallback(async () => {
    disconnect();
    await stopAiStt();
    setActiveTranscript({
      speaker: "system",
      text: "Call ended by you",
    });
    reset();
  }, [disconnect, stopAiStt, reset]);

  // Handle Microphone Mute (AssemblyAI)
  // useEffect(() => {
  //   if (wsStatus === "open") {
  //     if (isMuted) {
  //       stopAiStt();
  //     } else {
  //       startAiStt();
  //     }
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [isMuted, wsStatus]);

  return (
    <VoiceInterface
      wsStatus={computedWsStatus}
      audioStatus={audioStatus}
      duration={duration}
      isResponding={isResponding}
      activeTranscript={activeTranscript}
      currentTranscript={aiTranscript}
      onStart={handleStartCall}
      onEnd={handleEndCall}
      isMuted={isMuted}
      setIsMuted={setIsMuted}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      userName={userName}
      listening={aiIsRecording}
      voiceName={voice}
    />
  );
};

export default memo(AssemblyAIVoiceConnection);
