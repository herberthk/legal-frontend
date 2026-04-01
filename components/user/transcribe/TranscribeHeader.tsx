"use client";

import { FileText } from "lucide-react";
import { TranscribeStatus } from "@/hooks/use-document-transcribe";

interface TranscribeHeaderProps {
  status: TranscribeStatus;
  hasFile: boolean;
  onReset: () => void;
}

export function TranscribeHeader({
  status,
  hasFile,
  onReset,
}: TranscribeHeaderProps) {
  return (
    <header className="border-b border-indigo-500/10 dark:border-indigo-400/10 bg-white/70 dark:bg-slate-900 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 rotate-3 transition-transform hover:rotate-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-indigo-950 dark:text-indigo-50">
              Scribe
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400 font-bold">
              Premium Digitizer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(status !== "idle" || hasFile) && (
            <button
              onClick={onReset}
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-orange-600 dark:hover:text-orange-400 transition-all duration-300 px-5 py-2.5 rounded-full hover:bg-orange-50 dark:hover:bg-orange-950/30 border border-transparent hover:border-orange-200 dark:hover:border-orange-900"
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
