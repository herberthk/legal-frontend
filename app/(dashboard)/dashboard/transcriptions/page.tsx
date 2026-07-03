"use client";

import DirectionalTransition from "@/components/global/DirectionalTransition";
import { TranscriptionHistory } from "@/components/user/transcribe/TranscriptionHistory";
import { useRouter } from "nextjs-toploader/app";

const TranscriptionsPage = () => {
  const router = useRouter();

  return (
    <DirectionalTransition>
      <TranscriptionHistory
        onNewTranscription={() => router.push("/dashboard/transcribe")}
        onViewTranscription={(record) => {
          router.push(`/dashboard/transcriptions/${record.id}`);
        }}
      />
    </DirectionalTransition>
  );
};

export default TranscriptionsPage;
