"use client";

import React from "react";
import dynamic from "next/dynamic";
import { VoiceLoadingSkeleton } from "./VoiceSkeleton";

// Dynamically import the Gemini connection engine
const GeminiVoiceConnection = dynamic(
  () => import("./gemini-voice-connection"),
  {
    loading: () => <VoiceLoadingSkeleton />,
    ssr: false, // Ensure AudioContext isn't initialized on the server
  },
);

interface VoiceSessionManagerProps {
  freeVoiceSeconds: number;
  balance: number;
}

const VoiceSessionManager: React.FC<VoiceSessionManagerProps> = ({
  freeVoiceSeconds,
  balance,
}) => {
  return (
    <GeminiVoiceConnection
      freeVoiceSeconds={freeVoiceSeconds}
      balance={balance}
    />
  );
};

export default React.memo(VoiceSessionManager);
