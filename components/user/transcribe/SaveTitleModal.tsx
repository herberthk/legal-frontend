"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, CheckCircle2 } from "lucide-react";

interface SaveTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
  defaultTitle: string;
  isSaving: boolean;
}

export const SaveTitleModal = ({
  isOpen,
  onClose,
  onConfirm,
  defaultTitle,
  isSaving,
}: SaveTitleModalProps) => {
  const [title, setTitle] = useState(defaultTitle);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden border border-indigo-100 dark:border-indigo-900"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl">
                    <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Save <span className="text-indigo-600">Document</span>
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 ml-1">
                    Document Title
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Legal Agreement V1"
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500 transition-all duration-300"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && title.trim()) {
                          onConfirm(title.trim());
                        }
                      }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 ml-1">
                    This title will be used to identify your transcription in
                    history.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 px-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onConfirm(title.trim() || defaultTitle)}
                    disabled={isSaving}
                    className="flex-2 py-4 px-6 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    {isSaving ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
