"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileImage, X } from "lucide-react";
import Image from "next/image";

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  file: File | null;
}

export function ReferenceModal({
  isOpen,
  onClose,
  previewUrl,
  file,
}: ReferenceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && previewUrl && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-indigo-950/40 dark:bg-slate-900 backdrop-blur-md z-50 transition-colors"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40, rotateX: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40, rotateX: 10 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="fixed top-[5%] bottom-[5%] left-[4%] right-[4%] md:left-[8%] md:right-[8%] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-indigo-500/20 dark:border-indigo-400/10 z-50 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-indigo-500/10 dark:border-indigo-400/10 bg-white/80 dark:bg-slate-900 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-inner">
                  <FileImage className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold tracking-tight text-indigo-950 dark:text-indigo-50">
                    Original Source
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-900/40 dark:text-indigo-100/40">
                    High-Resolution Reference
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-slate-900 hover:bg-orange-500 dark:hover:bg-orange-600 transition-all duration-300 text-indigo-600 dark:text-indigo-400 hover:text-white group border border-indigo-100 dark:border-indigo-800/50 hover:scale-105 active:scale-95 shadow-sm"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 md:p-10 bg-indigo-50/30 dark:bg-slate-900 flex justify-center items-start">
              {file?.type === "application/pdf" ||
              previewUrl.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  className="w-full max-w-6xl h-full min-h-[700px] rounded-3xl border border-indigo-200 dark:border-indigo-900 shadow-2xl bg-white dark:bg-black/20"
                />
              ) : (
                <div className="w-full max-w-6xl h-auto rounded-3xl border border-indigo-200 dark:border-indigo-900 shadow-2xl relative min-h-[600px] bg-white dark:bg-black/20 overflow-hidden group">
                  <Image
                    src={previewUrl}
                    alt="Reference"
                    fill
                    style={{ objectFit: "contain" }}
                    unoptimized
                    className="rounded-3xl transition-transform duration-1000 group-hover:scale-[1.02]"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
