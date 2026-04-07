"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useVoiceSession } from "@/hooks";
import { useAuthStore } from "@/store";
import VoiceInterface from "./voice-interface";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants/constants";
import { logAnalyticsEvent } from "@/firebase/client";

interface NativeVoiceConnectionProps {
  freeVoiceSeconds: number;
  balance: number;
}

const NativeVoiceConnection: React.FC<NativeVoiceConnectionProps> = ({
  freeVoiceSeconds,
  balance,
}) => {
  const userName = useAuthStore((state) => state.user?.name);
  const userId = useAuthStore((state) => state.user?.id);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const totalAllowedSeconds = useMemo(() => {
    return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
  }, [freeVoiceSeconds, balance]);

  const isCreditExhausted = duration >= totalAllowedSeconds;
  const voice = useAuthStore((state) => state.user?.voicePreference);
  const [activeTranscript, setActiveTranscript] =
    useState<AgentTranscript | null>(null);

  const [isResponding, setIsResponding] = useState(false);

  const REMOTE_WEBSOCKET_SERVER = process.env.NEXT_PUBLIC_WEBSOCKET_SERVER;

  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url:
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? `ws://localhost:8000?uid=${userId}`
        : `wss://${REMOTE_WEBSOCKET_SERVER}?uid=${userId}`,
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
    if (wsStatus === "connecting" || wsStatus === "open" || isCreditExhausted)
      return;
    connect();
    logAnalyticsEvent("voice_call_start", { engine: "native" });
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  }, [connect, wsStatus, isCreditExhausted]);

  const handleEndCall = useCallback(async () => {
    disconnect();
    logAnalyticsEvent("voice_call_end", { engine: "native", duration });
    SpeechRecognition.stopListening();
    setActiveTranscript({
      speaker: "system",
      text: "You ended the call.",
    });
  }, [disconnect, duration]);

  useEffect(() => {
    if (isCreditExhausted && wsStatus === "open") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleEndCall();
    }
  }, [isCreditExhausted, wsStatus, handleEndCall]);

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
      freeVoiceSeconds={freeVoiceSeconds}
      isCreditExhausted={isCreditExhausted}
    />
  );
};

export default NativeVoiceConnection;
