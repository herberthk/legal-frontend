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
        <h2 className="font-serif text-5xl mb-4 font-light tracking-tight">
          Transform handwriting into <br />
          <span className="italic font-medium">professional documents.</span>
        </h2>
        <p className="text-lg text-[#1a1a1a]/60 max-w-xl mx-auto">
          Upload your handwritten legal notes, financial ledgers, or meeting
          minutes. Scribe will transcribe and format them into pristine PDFs.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-500 shadow-sm hover:shadow-xl ${
          isDragActive
            ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]"
            : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white/50 hover:bg-white"
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-20 h-20 mx-auto rounded-full bg-[#f5f2ed] border border-[#1a1a1a]/10 flex items-center justify-center mb-6 shadow-inner">
          <FileUp className="w-8 h-8 text-[#1a1a1a]/60" />
        </div>
        <h3 className="text-xl font-medium mb-2">Drag & drop your document</h3>
        <p className="text-[#1a1a1a]/60 mb-6">
          Supports JPG, PNG, WEBP, and PDF up to 10MB
        </p>
        <button className="px-8 py-3 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5">
          Select File
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-center">
          {error}
        </div>
      )}
    </motion.div>
  );
}
