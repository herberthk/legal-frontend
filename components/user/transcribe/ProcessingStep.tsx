"use client";

import { motion } from "framer-motion";
import { FileImage, FileText, ArrowRight, RotateCcw } from "lucide-react";
import Image from "next/image";
import { TranscribeStatus, FormatMode } from "@/hooks/use-document-transcribe";

interface ProcessingStepProps {
  status: TranscribeStatus;
  file: File | null;
  previewUrl: string | null;
  formatMode: FormatMode;
  setFormatMode: (mode: FormatMode) => void;
  processDocument: () => Promise<void>;
  onReset: () => void;
  error?: string | null;
}

export function ProcessingStep({
  status,
  file,
  previewUrl,
  formatMode,
  setFormatMode,
  processDocument,
  onReset,
  error,
}: ProcessingStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-[1400px] mx-auto w-full"
    >
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-14 shadow-2xl border border-indigo-500/10 dark:border-indigo-400/10 overflow-hidden relative">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-stretch relative z-10">
          <div className="w-full lg:w-3/5 aspect-3/4 rounded-[2rem] overflow-hidden bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 relative shadow-inner">
            {previewUrl && (
              <div className="relative w-full h-full">
                <Image
                  src={previewUrl}
                  alt="Document preview"
                  fill
                  style={{ objectFit: "cover" }}
                  unoptimized
                  className={`transition-all duration-1000 ${status === "processing" ? "scale-110 blur-[1px] brightness-[0.4] dark:brightness-[0.3]" : ""}`}
                />
              </div>
            )}

            {/* Premium Scanning Animation */}
            {status === "processing" && (
              <>
                <motion.div
                  className="absolute left-0 right-0 h-40 bg-linear-to-b from-transparent via-orange-500/30 to-orange-500 border-b-2 border-orange-400 z-20 shadow-[0_4px_20px_rgba(249,115,22,0.5)]"
                  animate={{ top: ["-30%", "110%"] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="absolute inset-0 bg-indigo-900/20 mix-blend-overlay z-10" />
              </>
            )}

            <div className="absolute inset-0 bg-linear-to-t from-indigo-950/60 to-transparent z-10" />
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 text-white z-20">
              <div className="p-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                <FileImage className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold truncate drop-shadow-md tracking-wide">
                {file?.name}
              </span>
            </div>
          </div>

          <div className="w-full lg:w-2/5 flex flex-col justify-center py-4">
            {status === "processing" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-center space-y-10 py-10"
              >
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <motion.div className="absolute inset-0 border-[3px] border-indigo-500/10 rounded-full" />
                  <motion.div
                    className="absolute inset-0 border-[3px] border-orange-500 rounded-full border-t-transparent border-l-transparent"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    className="absolute inset-4 border-2 border-indigo-500/30 rounded-full border-b-transparent border-r-transparent"
                    animate={{ rotate: -360 }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    animate={{
                      scale: [0.9, 1.1, 0.9],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="font-serif text-4xl font-bold mb-4 tracking-tight text-indigo-950 dark:text-indigo-50">
                    Digitizing...
                  </h3>
                  <p className="text-indigo-900/60 dark:text-indigo-100/60 text-lg leading-relaxed">
                    Analyzing handwritten patterns <br />
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      Applying AI formatting
                    </span>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, type: "spring", damping: 25 }}
              >
                <div className="mb-10">
                  <h3 className="font-serif text-3xl font-bold mb-3 tracking-tight text-indigo-950 dark:text-indigo-50">
                    Refine Extraction
                  </h3>
                  <p className="text-indigo-900/60 dark:text-indigo-100/60 font-medium italic">
                    Choose your document&apos;s output style
                  </p>
                </div>

                <div className="space-y-5 mb-12">
                  {[
                    {
                      id: "professional",
                      title: "Professional Format",
                      desc: "Restructures into a formal layout with headings. Perfect for legal or business use.",
                    },
                    {
                      id: "original",
                      title: "Maintain Original",
                      desc: "Preserves exact line breaks and raw structure as written.",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-4 p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-400 relative overflow-hidden group ${
                        formatMode === opt.id
                          ? "border-orange-500 bg-orange-50/20 dark:bg-orange-500/5 shadow-lg shadow-orange-500/5"
                          : "border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 bg-transparent"
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={opt.id}
                        checked={formatMode === opt.id}
                        onChange={() => setFormatMode(opt.id as FormatMode)}
                        className="mt-1.5 w-5 h-5 accent-orange-600 cursor-pointer"
                      />
                      <div className="relative z-10">
                        <p
                          className={`font-bold text-xl mb-1 transition-colors ${formatMode === opt.id ? "text-orange-700 dark:text-orange-400" : "text-indigo-950 dark:text-indigo-100"}`}
                        >
                          {opt.title}
                        </p>
                        <p className="text-sm text-indigo-900/60 dark:text-indigo-100/50 leading-relaxed font-medium">
                          {opt.desc}
                        </p>
                      </div>
                      {formatMode === opt.id && (
                        <motion.div
                          layoutId="active-bg"
                          className="absolute inset-0 bg-linear-to-r from-orange-100/20 to-transparent dark:from-orange-500/10 opacity-50"
                        />
                      )}
                    </label>
                  ))}
                </div>

                <button
                  onClick={processDocument}
                  className="group relative w-full py-5 rounded-[1.25rem] bg-indigo-600 dark:bg-indigo-500 text-white font-bold text-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all duration-300 flex items-center justify-center gap-3 shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-600/50 hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                  <span>Finalize Digitization</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={onReset}
                  className="w-full mt-4 py-3 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 font-bold transition-all duration-300 group"
                >
                  <RotateCcw className="w-4 h-4 group-hover:-rotate-45 transition-transform" />
                  <span>Start Over / Choose Different File</span>
                </button>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30 text-sm font-semibold shadow-sm text-center"
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
