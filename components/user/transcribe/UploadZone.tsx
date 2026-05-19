"use client";

import { motion } from "framer-motion";
import { FileUp } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface UploadZoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  error?: string | null;
}

export function UploadZone({ onDrop, error }: UploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-3xl mx-auto"
    >
      <div className="text-center mb-12">
        <h2 className="font-serif text-3xl md:text-5xl mb-6 font-bold tracking-tight text-indigo-950 dark:text-indigo-50">
          Transform handwriting into <br />
          <span className="italic text-orange-600 dark:text-orange-400">
            professional documents.
          </span>
        </h2>
        <p className="text-lg text-indigo-900/60 dark:text-indigo-100/60 max-w-xl mx-auto leading-relaxed">
          Upload your handwritten legal notes, financial ledgers, or meeting
          minutes. Scribe will transcribe and format them into pristine PDFs.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`relative group border-2 border-dashed rounded-[2.5rem] p-12 md:p-20 text-center cursor-pointer transition-all duration-500 overflow-hidden ${
          isDragActive
            ? "border-orange-500 bg-orange-50/30 dark:bg-orange-500/5 scale-[1.01]"
            : "border-indigo-200 dark:border-indigo-900/50 hover:border-orange-400/50 bg-white dark:bg-slate-900 shadow-2xl shadow-indigo-500/5 hover:shadow-orange-500/10"
        }`}
      >
        <input {...getInputProps()} />

        {/* Animated Background Element */}
        <div className="absolute inset-0 bg-linear-to-br from-indigo-50/50 to-transparent dark:from-indigo-500/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative z-10">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
            <FileUp className="w-10 h-10 text-indigo-600 dark:text-indigo-400 group-hover:text-orange-500 transition-colors" />
          </div>
          <h3 className="text-2xl font-bold mb-3 text-indigo-950 dark:text-indigo-50">
            Drag & drop your document
          </h3>
          <p className="text-indigo-900/40 dark:text-indigo-100/40 mb-8 font-medium">
            Supports JPG, PNG, WEBP, and PDF up to 10MB
          </p>
          <button className="px-10 py-4 rounded-full bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all duration-300 shadow-xl shadow-orange-500/25 hover:shadow-orange-600/40 hover:-translate-y-1 active:scale-95">
            Select File
          </button>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-5 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-900/30 text-center font-medium shadow-sm"
        >
          {error}
        </motion.div>
      )}
    </motion.div>
  );
}
