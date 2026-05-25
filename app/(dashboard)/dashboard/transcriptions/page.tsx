"use client";

import { TranscriptionHistory } from "@/components/user/transcribe/TranscriptionHistory";
import { useRouter } from "nextjs-toploader/app";

const TranscriptionsPage = () => {
  const router = useRouter();

  return (
    <TranscriptionHistory
      onNewTranscription={() => router.push("/dashboard/transcribe")}
      onViewTranscription={(record) => {
        router.push(`/dashboard/transcriptions/${record.id}`);
      }}
    />
  );
};

export default TranscriptionsPage;
