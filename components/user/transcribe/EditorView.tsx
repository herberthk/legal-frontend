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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="flex flex-col h-full min-h-[85vh] w-full max-w-[1500px] mx-auto"
    >
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8 px-2">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-indigo-500/10 dark:border-indigo-400/10 shadow-xl shadow-indigo-500/5">
          <button
            onClick={() => setStatus("editing")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${status === "editing" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "text-indigo-900/40 dark:text-indigo-100/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"}`}
          >
            <Edit3 className="w-4 h-4" />
            Edit Transcription
          </button>
          <button
            onClick={() => setStatus("previewing")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${status === "previewing" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "text-indigo-900/40 dark:text-indigo-100/40 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"}`}
          >
            <FileText className="w-4 h-4" />
            Final Preview
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {status === "previewing" && (
            <>
              <button
                onClick={onShowReference}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all duration-300 shadow-sm border-b-4 active:border-b-0 active:translate-y-1"
              >
                <FileImage className="w-4 h-4" />
                Original
              </button>
              <button
                onClick={onDownload}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all duration-300 shadow-lg shadow-orange-500/20 active:scale-95 active:translate-y-1 border-b-4 border-orange-800"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-indigo-500/10 dark:border-indigo-400/10 flex-1 overflow-hidden flex flex-col md:flex-row transition-shadow duration-500">
        {/* Responsive Side: Original Document Reference */}
        {previewUrl && status === "editing" && (
          <div className="w-full md:w-[35%] border-b md:border-b-0 md:border-r border-indigo-500/10 dark:border-indigo-400/10 bg-indigo-50/20 dark:bg-slate-900 p-6 flex flex-col min-h-[300px] md:min-h-0">
            <div className="sticky top-0 pb-4 mb-4 border-b border-indigo-500/10 dark:border-indigo-400/10 flex items-center gap-2 text-indigo-900/60 dark:text-indigo-100/60 z-10 font-bold text-xs uppercase tracking-widest">
              <FileImage className="w-4 h-4 text-orange-500" />
              Source Document
            </div>
            {file?.type === "application/pdf" ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                className="w-full flex-1 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-inner bg-white dark:bg-slate-900"
              />
            ) : (
              <div className="relative w-full h-full min-h-[300px] rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-xl overflow-hidden bg-white/50 dark:bg-black/20 backdrop-blur-sm group">
                <Image
                  src={previewUrl}
                  alt="Reference"
                  fill
                  style={{ objectFit: "contain" }}
                  unoptimized
                  className="transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            )}
          </div>
        )}

        {/* Responsive Main: Editor or Preview */}
        <div
          className={`flex-1 flex flex-col overflow-hidden bg-white/20 dark:bg-slate-900 items-center overflow-y-auto p-4`}
        >
          <div className="w-full max-w-4xl min-h-full">
            <TiptapEditor
              content={transcription}
              onChange={setTranscription}
              readOnly={status === "previewing"}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
