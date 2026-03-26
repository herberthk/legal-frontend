import VoiceSessionManager from "@/components/voice/voice-session-manager";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Voice Session | Legal Adviser",
  description: "Real-time voice consultation with our AI legal assistant.",
};

export default function VoicePage() {
  return <VoiceSessionManager />;
}
