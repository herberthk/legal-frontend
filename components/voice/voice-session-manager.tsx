"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { VoiceLoadingSkeleton } from "./VoiceSkeleton";

// Dynamically import connection engines
const NativeVoiceConnection = dynamic(
  () => import("./native-voice-connection"),
  {
    loading: () => <VoiceLoadingSkeleton />,
  },
);

const AssemblyAIVoiceConnection = dynamic(
  () => import("./assemblyai-voice-connection"),
  {
    loading: () => <VoiceLoadingSkeleton />,
  },
);

const VoiceSessionManager = () => {
  const [hasNative, setHasNative] = useState<boolean | null>(null);

  useEffect(() => {
    // Perform browser feature detection for SpeechRecognition
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasNative(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    );
  }, []);

  // Avoid hydration mismatch by waiting for detection to complete
  if (hasNative === null) {
    return <VoiceLoadingSkeleton />;
  }

  return hasNative ? <NativeVoiceConnection /> : <AssemblyAIVoiceConnection />;
};

export default React.memo(VoiceSessionManager);
