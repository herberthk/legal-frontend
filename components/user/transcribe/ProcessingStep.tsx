"use client";

import { motion } from "framer-motion";
import { FileImage, FileText, ArrowRight } from "lucide-react";
import Image from "next/image";
import { TranscribeStatus, FormatMode } from "@/hooks/use-document-transcribe";

interface ProcessingStepProps {
  status: TranscribeStatus;
  file: File | null;
  previewUrl: string | null;
  formatMode: FormatMode;
  setFormatMode: (mode: FormatMode) => void;
  processDocument: () => Promise<void>;
  error?: string | null;
}

export function ProcessingStep({
  status,
  file,
  previewUrl,
  formatMode,
  setFormatMode,
  processDocument,
  error,
}: ProcessingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white rounded-3xl p-8 shadow-2xl border border-[#1a1a1a]/10 overflow-hidden relative">
        <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
          <div className="w-full md:w-1/2 aspect-3/4 rounded-2xl overflow-hidden bg-[#f5f2ed] border border-[#1a1a1a]/10 relative shadow-inner">
            {previewUrl && (
              <div className="relative w-full h-full">
                <Image
                  src={previewUrl}
                  alt="Document preview"
                  fill
                  style={{ objectFit: "cover" }}
                  unoptimized // Required for blob URLs
                  className={`transition-all duration-700 ${status === "processing" ? "scale-105 blur-[2px] brightness-75" : ""}`}
                />
              </div>
            )}

            {/* Scanning Animation */}
            {status === "processing" && (
              <>
                <motion.div
                  className="absolute left-0 right-0 h-32 bg-linear-to-b from-transparent to-[#1a1a1a]/40 border-b-2 border-[#1a1a1a] z-20"
                  animate={{ top: ["-20%", "100%"] }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <div className="absolute inset-0 bg-[#1a1a1a]/10 mix-blend-overlay z-10" />
              </>
            )}

            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent z-10" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-white z-20">
              <FileImage className="w-4 h-4 drop-shadow-md" />
              <span className="text-sm font-medium truncate drop-shadow-md">
                {file?.name}
              </span>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex flex-col h-full justify-center">
            {status === "processing" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-8 py-12"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div className="absolute inset-0 border-4 border-[#1a1a1a]/10 rounded-full" />
                  <motion.div
                    className="absolute inset-0 border-4 border-[#1a1a1a] rounded-full border-t-transparent border-l-transparent"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    animate={{
                      scale: [0.9, 1.1, 0.9],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <FileText className="w-8 h-8 text-[#1a1a1a]" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="font-serif text-3xl font-bold mb-3 tracking-tight">
                    Digitizing...
                  </h3>
                  <p className="text-[#1a1a1a]/60 text-lg">
                    Extracting text and applying professional formatting
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="font-serif text-3xl mb-6 tracking-tight">
                  Processing Options
                </h3>

                <div className="space-y-4 mb-8">
                  <label
                    className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formatMode === "professional" ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]" : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white"}`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value="professional"
                      checked={formatMode === "professional"}
                      onChange={() => setFormatMode("professional")}
                      className="mt-1.5 w-4 h-4 accent-[#1a1a1a]"
                    />
                    <div>
                      <p className="font-medium mb-1 text-lg">
                        Professional Format
                      </p>
                      <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">
                        Restructures text into a clean, formal layout with
                        headings. Ideal for legal, financial, or business
                        documents.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formatMode === "original" ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]" : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white"}`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value="original"
                      checked={formatMode === "original"}
                      onChange={() => setFormatMode("original")}
                      className="mt-1.5 w-4 h-4 accent-[#1a1a1a]"
                    />
                    <div>
                      <p className="font-medium mb-1 text-lg">
                        Maintain Original
                      </p>
                      <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">
                        Transcribes exactly as written, preserving line breaks
                        and original structure without adding new formatting.
                      </p>
                    </div>
                  </label>
                </div>

                <button
                  onClick={processDocument}
                  className="w-full py-4 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Start Digitization
                  <ArrowRight className="w-5 h-5" />
                </button>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm shadow-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
