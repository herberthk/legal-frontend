"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getTranscriptionRecord } from "@/lib/actions/transcribe";
import Transcribe from "../../transcribe/Transcribe";

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
          toast.error("Failed to load transcription", { description: res.error });
          router.push("/dashboard/user/transcriptions");
        }
      } catch (error) {
        toast.error("Error loading transcription");
        router.push("/dashboard/user/transcriptions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecord();
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-50/5 dark:bg-slate-900 transition-colors duration-500">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">
          Loading transcription...
        </p>
      </div>
    );
  }

  if (!record) {
    return null; // Will redirect in useEffect
  }

  return (
    <Transcribe 
      initialRecord={record} 
      onClose={() => router.push("/dashboard/user/transcriptions")} 
    />
  );
}
