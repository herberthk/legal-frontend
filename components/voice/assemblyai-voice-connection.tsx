"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useVoiceSession, useAssemblyAITranscription } from "@/hooks";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";
import { Transcript } from "./types";

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
  });

  useEffect(() => {
    if (wsStatus === "open") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTranscript({
        speaker: "system",
        text: "Connected. AssemblyAI STT ready.",
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      llmText={llmText}
      onStart={handleStartCall}
      onEnd={handleEndCall}
      isMuted={isMuted}
      setIsMuted={setIsMuted}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      userName={user?.name}
      listening={aiIsRecording}
    />
  );
};

export default AssemblyAIVoiceConnection;
