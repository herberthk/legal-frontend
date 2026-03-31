"use client";

import { motion } from "framer-motion";
import { Edit3, FileText, FileImage, Download } from "lucide-react";
import Image from "next/image";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { TranscribeStatus } from "@/hooks/use-document-transcribe";

interface EditorViewProps {
  status: TranscribeStatus;
  setStatus: (status: TranscribeStatus) => void;
  transcription: string;
  setTranscription: (text: string) => void;
  previewUrl: string | null;
  file: File | null;
  onShowReference: () => void;
  onDownload: () => void;
}

export function EditorView({
  status,
  setStatus,
  transcription,
  setTranscription,
  previewUrl,
  file,
  onShowReference,
  onDownload,
}: EditorViewProps) {
  return (
    <motion.div
      key="editor"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-[calc(100vh-12rem)]"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-white rounded-full p-1.5 border border-[#1a1a1a]/10 shadow-sm">
          <button
            onClick={() => setStatus("editing")}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${status === "editing" ? "bg-[#1a1a1a] text-[#f5f2ed] shadow-md scale-[1.02]" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5"}`}
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Edit
            </div>
          </button>
          <button
            onClick={() => setStatus("previewing")}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${status === "previewing" ? "bg-[#1a1a1a] text-[#f5f2ed] shadow-md scale-[1.02]" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5"}`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Preview
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {status === "previewing" && (
            <>
              <button
                onClick={onShowReference}
                className="px-6 py-2.5 rounded-full bg-white border border-[#1a1a1a]/10 text-[#1a1a1a] font-medium hover:bg-[#f5f2ed] transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <FileImage className="w-4 h-4" />
                View Original
              </button>
              <button
                onClick={onDownload}
                className="px-6 py-2.5 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-[#1a1a1a]/10 h-full overflow-hidden flex transition-shadow duration-500 hover:shadow-2xl">
        {/* Left side: Original Document Reference */}
        {previewUrl && status === "editing" && (
          <div className="w-1/3 border-r border-[#1a1a1a]/10 bg-[#f5f2ed]/50 p-6 overflow-y-auto flex flex-col">
            <div className="sticky top-0 pb-4 mb-4 border-b border-[#1a1a1a]/10 flex items-center gap-2 text-[#1a1a1a]/60 bg-[#f5f2ed]/50 backdrop-blur-sm z-10">
              <FileImage className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-wider">
                Original Reference
              </span>
            </div>
            {file?.type === "application/pdf" ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                className="w-full flex-1 min-h-[500px] rounded-xl border border-[#1a1a1a]/10 shadow-md bg-white transition-shadow hover:shadow-lg"
              />
            ) : (
              <div className="relative w-full h-[500px] rounded-xl border border-[#1a1a1a]/10 shadow-md overflow-hidden bg-white">
                <Image
                  src={previewUrl}
                  alt="Reference"
                  fill
                  style={{ objectFit: "contain" }}
                  unoptimized
                  className="transition-shadow hover:shadow-lg"
                />
              </div>
            )}
          </div>
        )}

        {/* Right side: Editor or Preview */}
        <div
          className={`flex-1 flex flex-col overflow-hidden bg-[#f5f2ed]/30 items-center overflow-y-auto p-8`}
        >
          <TiptapEditor
            content={transcription}
            onChange={setTranscription}
            readOnly={status === "previewing"}
          />
        </div>
      </div>
    </motion.div>
  );
}
