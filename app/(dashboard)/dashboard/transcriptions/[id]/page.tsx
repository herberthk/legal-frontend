"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";
import { getTranscriptionRecord } from "@/lib/actions/transcribe";
import Transcribe from "../../transcribe/Transcribe";
import { ViewRecordSkeleton } from "@/components/user/transcribe/TranscriptionSkeleton";

export default function TranscriptionViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [record, setRecord] = useState<TranscriptionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id || typeof id !== "string") return;

    const fetchRecord = async () => {
      try {
        const res = await getTranscriptionRecord(id);
        if (res.success && res.record) {
          setRecord(res.record);
        } else {
          toast.error("Failed to load transcription", {
            description: res.error,
            style: {
              backgroundColor: "#dc2626",
              color: "white",
            },
          });
          router.push("/dashboard/transcriptions");
        }
      } catch (error) {
        toast.error("Error loading transcription", {
          description: (error as Error).message,
          style: {
            backgroundColor: "#dc2626",
            color: "white",
          },
        });
        router.push("/dashboard/transcriptions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecord();
  }, [id]);

  if (isLoading) {
    return <ViewRecordSkeleton />;
  }

  if (!record) {
    return null; // Will redirect in useEffect
  }

  return (
    <Transcribe
      initialRecord={record}
      onClose={() => router.push("/dashboard/transcriptions")}
    />
  );
}
