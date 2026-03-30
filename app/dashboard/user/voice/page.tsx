import VoiceSessionManager from "@/components/voice/voice-session-manager";
import { Metadata } from "next";
import { getCurrentUser } from "@/lib/actions/auth";
import { checkUserInfo } from "@/lib/actions/usage";

export const metadata: Metadata = {
  title: "Voice Session | Legal Adviser",
  description: "Real-time voice consultation with our AI legal assistant.",
};

export default async function VoicePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const usageResult = await checkUserInfo(user.id);
  const freeVoiceSeconds = usageResult.user?.freeVoiceSeconds ?? 0;
  const balance = usageResult.user?.balance ?? 0;

  return (
    <VoiceSessionManager
      freeVoiceSeconds={freeVoiceSeconds}
      balance={balance}
    />
  );
}
