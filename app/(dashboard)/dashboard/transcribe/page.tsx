import DirectionalTransition from "@/components/global/DirectionalTransition";
import Transcribe from "./Transcribe";
import type { Metadata } from "next";

export const maxDuration = 30;

export const metadata: Metadata = {
  title: "Document Transcribe | Legal Adviser Uganda",
  description:
    "Digitize handwritten and printed legal documents, contracts, receipts, and memos using AI-powered OCR. Export to PDF or Word format instantly.",
};

const Page = () => {
  return (
    <DirectionalTransition>
      <Transcribe />
    </DirectionalTransition>
  );
};

export default Page;

