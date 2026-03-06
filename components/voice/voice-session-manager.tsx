"use client";

import React, { useState, useEffect } from "react";
import NativeVoiceConnection from "./native-voice-connection";
import AssemblyAIVoiceConnection from "./assemblyai-voice-connection";

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
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // return hasNative ? <NativeVoiceConnection /> : <AssemblyAIVoiceConnection />;
  return <AssemblyAIVoiceConnection />;
};

export default React.memo(VoiceSessionManager);
