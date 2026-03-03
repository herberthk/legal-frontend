"use client";

import { useState, useEffect, useCallback } from "react";
import { useVoiceSession, useAssemblyAITranscription } from "@/hooks";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";

const AssemblyAIVoiceConnection = () => {
  const user = useAuthStore((state) => state.user);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const voice = "Blake";
  const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(
    null,
  );

  const [llmText, setLlmText] = useState("");
  const [isResponding, setIsResponding] = useState(false);

  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url: `ws://localhost:8000?voice=${voice}`,
    onText: (delta) => setLlmText((prev) => prev + delta),
    onInterrupt: () => setIsResponding(false),
    onAudioDone: () => setIsResponding(false),
    onError: (msg) => {
      setIsResponding(false);
      setActiveTranscript({
        speaker: "system",
        text: `Error: ${msg}`,
      });
    },
    onDuration: (d) => setDuration(d),
    isAudioMuted,
  });

  // Handle Microphone Mute (AssemblyAI)
  useEffect(() => {
    if (wsStatus === "open") {
      if (isMuted) {
        stopAiStt();
      } else {
        startAiStt();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, wsStatus]);

  useEffect(() => {
    if (wsStatus === "open") {
      setActiveTranscript({
        speaker: "system",
        text: "Getting things ready...",
      });
    }
  }, [wsStatus]);

  const handleTurnEnd = (text: string) => {
    setLlmText("");
    setIsResponding(true);
    send(text);
    setActiveTranscript({
      speaker: "user",
      text: text,
    });
  };

  const {
    transcript: aiTranscript,
    isRecording: aiIsRecording,
    start: startAiStt,
    stop: stopAiStt,
  } = useAssemblyAITranscription({
    onTurnEnd: handleTurnEnd,
  });

  useEffect(() => {
    if (llmText) {
      setActiveTranscript({
        speaker: "ai",
        text: llmText,
      });
    }
  }, [llmText]);

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open") return;
    connect();
    await startAiStt();
  }, [connect, startAiStt, wsStatus]);

  const handleEndCall = async () => {
    disconnect();
    await stopAiStt();
    setActiveTranscript({
      speaker: "system",
      text: "Call ended by user.",
    });
  };

  return (
    <VoiceInterface
      wsStatus={wsStatus}
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
      userName={user?.name}
      listening={aiIsRecording}
      voiceName={voice}
    />
  );
};

export default AssemblyAIVoiceConnection;
