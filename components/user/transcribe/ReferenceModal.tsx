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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-[5%] bottom-[5%] left-[5%] right-[5%] md:left-[10%] md:right-[10%] bg-white rounded-3xl shadow-2xl border border-[#1a1a1a]/10 z-50 overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]/10 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-2 text-[#1a1a1a]">
                <FileImage className="w-5 h-5" />
                <h3 className="font-serif text-xl font-bold tracking-tight">
                  Original Reference
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1a1a1a]/5 transition-colors text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8 bg-[#f5f2ed]/50 flex justify-center items-start">
              {file?.type === "application/pdf" ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  className="w-full max-w-5xl h-full min-h-[700px] rounded-2xl border border-[#1a1a1a]/10 shadow-xl bg-white"
                />
              ) : (
                <div className="w-full max-w-5xl h-auto rounded-2xl border border-[#1a1a1a]/10 shadow-xl relative min-h-[500px] bg-white overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Reference"
                    fill
                    style={{ objectFit: "contain" }}
                    unoptimized
                    className="rounded-2xl"
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
