"use client";

import { FileText } from "lucide-react";
import { TranscribeStatus } from "@/hooks/use-document-transcribe";

interface TranscribeHeaderProps {
  status: TranscribeStatus;
  hasFile: boolean;
  onReset: () => void;
}

export function TranscribeHeader({ status, hasFile, onReset }: TranscribeHeaderProps) {
  return (
    <header className="border-b border-[#1a1a1a]/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#f5f2ed]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              Scribe
            </h1>
            <p className="text-xs font-mono uppercase tracking-widest text-[#1a1a1a]/60">
              Document Digitizer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(status !== "idle" || hasFile) && (
            <button
              onClick={onReset}
              className="text-sm font-medium hover:text-[#1a1a1a]/70 transition-colors px-4 py-2 rounded-full hover:bg-[#1a1a1a]/5"
            >
              Start Over
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
