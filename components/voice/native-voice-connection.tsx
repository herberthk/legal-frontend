"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useVoiceSession } from "@/hooks";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";

const NativeVoiceConnection = () => {
  const userName = useAuthStore((state) => state.user?.name);
  const userId = useAuthStore((state) => state.user?.id);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const voice = useAuthStore((state) => state.user?.voicePreference);
  const [activeTranscript, setActiveTranscript] =
    useState<AgentTranscript | null>(null);

  const [isResponding, setIsResponding] = useState(false);

  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url: `ws://localhost:8000?uid=${userId}`,
    onText: (delta) => {
      setActiveTranscript((prev) => {
        const nextText = (prev?.speaker === "ai" ? prev.text : "") + delta;
        // console.log("nextText", nextText);
        return {
          speaker: "ai",
          text: nextText,
        };
      });
    },
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

  const handleStartCall = useCallback(async () => {
    if (wsStatus === "connecting" || wsStatus === "open") return;
    connect();
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  }, [connect, wsStatus]);

  const handleEndCall = useCallback(async () => {
    disconnect();
    SpeechRecognition.stopListening();
    setActiveTranscript({
      speaker: "system",
      text: "You ended the call.",
    });
  }, [disconnect]);

  useEffect(() => {
    console.log("connection status", wsStatus);
  }, [wsStatus]);

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
      userName={userName}
      listening={listening}
      voiceName={voice}
    />
  );
};

export default NativeVoiceConnection;
