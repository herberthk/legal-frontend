import React from "react";
import { Loader2, FileText, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAttachmentPreviewProps {
  isUploading: boolean;
  isInputFocused: boolean;
  uploadProgress: number;
  activeFileName: string;
  onCancelUpload: () => void;
  onRemoveAttachment: () => void;
}

export const ChatAttachmentPreview: React.FC<ChatAttachmentPreviewProps> = React.memo(({
  isUploading,
  isInputFocused,
  uploadProgress,
  activeFileName,
  onCancelUpload,
  onRemoveAttachment,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{
        opacity: isInputFocused ? 0.8 : 1,
        y: 0,
        scale: isInputFocused ? 0.98 : 1,
        marginBottom: isInputFocused ? "0.25rem" : "0.75rem",
      }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="origin-bottom"
    >
      <div
        className={`flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl relative overflow-hidden transition-all duration-300 hover:shadow-md ${
          isInputFocused ? "p-2" : "p-3"
        }`}
      >
        {/* Premium Upload progress bar */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 via-orange-500 to-amber-600 z-10"
            >
              <motion.div
                className="h-full w-full"
                initial={{ width: "0%" }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{
                  type: "spring",
                  stiffness: 50,
                  damping: 20,
                }}
              >
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 flex items-center justify-center text-orange-500 shadow-sm mr-3 shrink-0 transition-all duration-300 ${
            isInputFocused ? "h-8 w-8" : "h-10 w-10"
          }`}
        >
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Loader2
                  size={isInputFocused ? 16 : 20}
                  className="animate-spin text-slate-400"
                />
              </motion.div>
            ) : (
              <motion.div
                key="file-icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <FileText size={isInputFocused ? 16 : 20} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-w-0 mr-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {activeFileName}
            </span>
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.span
                  key="progress-text"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xs text-slate-500 font-medium tabular-nums"
                >
                  {uploadProgress}%
                </motion.span>
              ) : (
                <motion.span
                  key="ready-text"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center text-xs text-green-600 dark:text-green-400 font-medium"
                >
                  <CheckCircle2 size={12} className="mr-1" /> Ready
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              isInputFocused
                ? "max-h-0 opacity-0"
                : "max-h-5 opacity-100"
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={isUploading ? "uploading" : "attached"}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5"
              >
                {isUploading
                  ? "Uploading to secure storage…"
                  : "Document attached for analysis"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <button
          onClick={isUploading ? onCancelUpload : onRemoveAttachment}
          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-all duration-300 hover:rotate-90 shrink-0"
          title={isUploading ? "Cancel upload" : "Remove attachment"}
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
});

ChatAttachmentPreview.displayName = "ChatAttachmentPreview";
