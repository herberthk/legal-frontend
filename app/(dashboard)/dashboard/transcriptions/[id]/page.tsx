import DirectionalTransition from "@/components/global/DirectionalTransition";
import { getTranscriptionRecord } from "@/lib/actions/transcribe";
import { notFound } from "next/navigation";
import { TranscriptionViewClient } from "./TranscriptionViewClient";
import type { Metadata } from "next";

export const maxDuration = 30;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getTranscriptionRecord(id);
  const title =
    res.success && res.record?.title ? res.record.title : "Transcription";
  return {
    title: `${title} | Legal Adviser Uganda`,
    description: "View, edit, and export transcribed legal documents.",
  };
}

export default async function TranscriptionViewPage({ params }: PageProps) {
  const { id } = await params;
  const res = await getTranscriptionRecord(id);

  if (!res.success || !res.record) {
    notFound();
  }

  return (
    <DirectionalTransition>
      <TranscriptionViewClient initialRecord={res.record} />
    </DirectionalTransition>
  );
}
