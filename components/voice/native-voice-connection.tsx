"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useVoiceSession } from "@/hooks";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";

const NativeVoiceConnection = () => {
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

  // Handle Microphone Mute (STT)
  useEffect(() => {
    if (wsStatus === "open") {
      if (isMuted) {
        SpeechRecognition.stopListening();
      } else {
        SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        });
      }
    }
  }, [isMuted, wsStatus]);

  useEffect(() => {
    if (wsStatus === "open") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTranscript({
        speaker: "system",
        text: "Getting things ready...",
      });
    }
  }, [wsStatus]);

  const { transcript, finalTranscript, listening, resetTranscript } =
    useSpeechRecognition();

  const lastSentRef = useRef("");

  useEffect(() => {
    if (
      finalTranscript &&
      finalTranscript !== lastSentRef.current &&
      wsStatus === "open"
    ) {
      lastSentRef.current = finalTranscript;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLlmText("");
      setIsResponding(true);
      send(finalTranscript);
      setActiveTranscript({
        speaker: "user",
        text: finalTranscript,
      });

      resetTranscript();
      lastSentRef.current = "";
    }
  }, [finalTranscript, wsStatus, send, resetTranscript]);

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
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  }, [connect, wsStatus]);

  const handleEndCall = async () => {
    disconnect();
    SpeechRecognition.stopListening();
    setActiveTranscript({
      speaker: "system",
      text: "You ended the call.",
    });
  };

  console.log("connection status", wsStatus);
  return (
    <VoiceInterface
      wsStatus={wsStatus}
      audioStatus={audioStatus}
      duration={duration}
      isResponding={isResponding}
      activeTranscript={activeTranscript}
      currentTranscript={transcript}
      onStart={handleStartCall}
      onEnd={handleEndCall}
      isMuted={isMuted}
      setIsMuted={setIsMuted}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      userName={user?.name}
      listening={listening}
      voiceName={voice}
    />
  );
};

export default NativeVoiceConnection;
