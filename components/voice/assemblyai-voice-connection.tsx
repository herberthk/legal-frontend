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
    onInterrupt: () => {
      setIsResponding(false);
      reset();
      setLlmText("");
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

  const handleTurnEnd = (text: string) => {
    setLlmText("");
    setIsResponding(true);
    setActiveTranscript({
      speaker: "user",
      text: text,
    });
    send(text);
    reset();
  };

  const {
    transcript: aiTranscript,
    isRecording: aiIsRecording,
    start: startAiStt,
    stop: stopAiStt,
    isConnecting: isSttConnecting,
    error: transcriptError,
    reset,
  } = useAssemblyAITranscription({
    onTurnEnd: handleTurnEnd,
    onError: (err) => console.error("[stt]", err),
  });

  const computedWsStatus: VoiceSessionStatus = (() => {
    if (wsStatus === "error" || transcriptError) return "error";
    if (wsStatus === "open" && (aiIsRecording || isMuted)) return "open";
    if (wsStatus === "connecting" || isSttConnecting) return "connecting";
    return wsStatus;
  })();

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

  const handleEndCall = async () => {
    disconnect();
    await stopAiStt();
    setActiveTranscript({
      speaker: "system",
      text: "Call ended by you",
    });
    reset();
  };

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
      userName={user?.name}
      listening={aiIsRecording}
      voiceName={voice}
      isAssemblyAIRecording={aiIsRecording}
    />
  );
};

export default AssemblyAIVoiceConnection;
