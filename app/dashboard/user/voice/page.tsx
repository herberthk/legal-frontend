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
    <>
      <head>
        <link
          rel="preload"
          href="/images/voice-bg.jpg"
          as="image"
          media="(min-width: 768px)"
        />
        <link
          rel="preload"
          href="/images/voice-bg-mobile.jpg"
          as="image"
          media="(max-width: 767px)"
        />
      </head>
      <VoiceSessionManager
        freeVoiceSeconds={freeVoiceSeconds}
        balance={balance}
      />
    </>
  );
}
