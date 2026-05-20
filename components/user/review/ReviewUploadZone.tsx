"use client";

import { motion } from "framer-motion";
import { FileUp, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  MAX_REVIEW_FILE_SIZE,
  MAX_REVIEW_FILE_SIZE_MB,
  MAX_REVIEW_PAGES,
} from "@/constants";

interface ReviewUploadZoneProps {
  onDrop: (files: File[]) => void;
  error?: string | null;
  file?: File | null;
  onStart: () => void;
}

export function ReviewUploadZone({
  onDrop,
  error,
  file,
  onStart,
}: ReviewUploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: MAX_REVIEW_FILE_SIZE,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-3xl mx-auto"
    >
      {/* Hero heading */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Powered by Most advanced AI Models
        </div>
        <h2 className="font-serif text-3xl md:text-5xl mb-5 font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Review any legal document{" "}
          <span className="italic text-emerald-600 dark:text-emerald-400">
            instantly.
          </span>
        </h2>
        <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          Upload your PDF and receive a comprehensive compliance score, risk
          analysis, key clauses, and recommendations — all grounded in Ugandan
          law.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative group border-2 border-dashed rounded-[2.5rem] p-12 md:p-16 text-center cursor-pointer transition-all duration-500 overflow-hidden ${
          isDragActive
            ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/5 scale-[1.01]"
            : "border-slate-200 dark:border-slate-700 hover:border-emerald-400/60 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-500/5 hover:shadow-emerald-500/10"
        }`}
      >
        <input {...getInputProps()} />

        {/* Gradient glow */}
        <div className="absolute inset-0 bg-linear-to-br from-emerald-50/60 to-transparent dark:from-emerald-500/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        <div className="relative z-10">
          {file ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-inner">
                <FileText className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-800 dark:text-slate-100 font-bold text-lg">
                  {file.name}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                </p>
              </div>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                Drop a different file to replace
              </p>
            </motion.div>
          ) : (
            <>
              <div className="w-24 h-24 mx-auto rounded-3xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-7 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <FileUp className="w-10 h-10 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-50">
                Drag & drop your PDF
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium text-sm">
                PDF only · Max {MAX_REVIEW_FILE_SIZE_MB}MB · Up to{" "}
                {MAX_REVIEW_PAGES} pages
              </p>
              <button
                type="button"
                className="px-9 py-3.5 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all duration-300 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-95"
              >
                Browse File
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 text-sm font-medium text-center"
        >
          {error}
        </motion.div>
      )}

      {/* Start review CTA */}
      {file && !error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex justify-center"
        >
          <button
            onClick={onStart}
            className="group flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-600/50 hover:-translate-y-1 active:scale-95"
          >
            <span className="w-2 h-2 rounded-full bg-white/70 group-hover:bg-white transition-colors" />
            Start Legal Review
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
