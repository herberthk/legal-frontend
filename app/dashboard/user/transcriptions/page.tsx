"use client";

import { TranscriptionHistory } from "@/components/user/transcribe/TranscriptionHistory";
import { useRouter } from "next/navigation";

const TranscriptionsPage = () => {
  const router = useRouter();

  return (
    <TranscriptionHistory 
      onNewTranscription={() => router.push("/dashboard/user/transcribe")} 
      onViewTranscription={(record) => {
        router.push(`/dashboard/user/transcriptions/${record.id}`);
      }} 
    />
  );
};

export default TranscriptionsPage;
