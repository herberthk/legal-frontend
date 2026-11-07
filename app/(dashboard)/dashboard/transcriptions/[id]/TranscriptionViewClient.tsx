"use client";

import { useRouter } from "nextjs-toploader/app";
import Transcribe from "../../transcribe/Transcribe";

interface TranscriptionViewClientProps {
  initialRecord: TranscriptionRecord;
}

export function TranscriptionViewClient({
  initialRecord,
}: TranscriptionViewClientProps) {
  const router = useRouter();

  return (
    <Transcribe
      initialRecord={initialRecord}
      onClose={() => router.push("/dashboard/transcriptions")}
    />
  );
}
