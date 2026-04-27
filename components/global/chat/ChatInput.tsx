import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import Disclaimer from "./Disclaimer";
import { useRouter } from "nextjs-toploader/app";
import { motion, AnimatePresence } from "framer-motion";
import { logAnalyticsEvent, storage } from "@/firebase/client";
import {
  ref as firebaseRef,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from "firebase/storage";
import { BUCKETS } from "@/constants";

export interface ChatInputRef {
  triggerFileUpload: (promptText: string) => void;
}

type ChatInputProps = {
  onSend: (
    text: string,
    attachment?: { name: string; contentType: string; url: string },
  ) => void;

  connectionStatus: string;
  isLoading: boolean;
  onHeightChange?: () => void;
};

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ onSend, connectionStatus, isLoading, onHeightChange }, ref) => {
    const [input, setInput] = useState("");
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [tempFileName, setTempFileName] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<{
      name: string;
      contentType: string;
      url: string;
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTaskRef = useRef<UploadTask | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();

    // Notify parent of layout/height changes for auto-scroll
    useEffect(() => {
      onHeightChange?.();
    }, [input, isUploading, pendingAttachment, isInputFocused, onHeightChange]);

    // Auto-expand textarea based on content
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
      }
    }, [input]);

    // Cancel the Firebase upload task on unmount
    useEffect(() => {
      return () => {
        uploadTaskRef.current?.cancel();
      };
    }, []);

    useImperativeHandle(ref, () => ({
      triggerFileUpload: (promptText: string) => {
        setInput(promptText);
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      },
    }));

    const handleSendClick = () => {
      if (
        isLoading ||
        isUploading ||
        connectionStatus === "offline" ||
        !input.trim()
      ) {
        return;
      }

      onSend(input, pendingAttachment || undefined);
      logAnalyticsEvent("send_message", {
        has_attachment: !!pendingAttachment,
        attachment_type: pendingAttachment?.contentType || "none",
      });
      setInput("");
      setPendingAttachment(null);
    };

    const cancelUpload = useCallback(() => {
      uploadTaskRef.current?.cancel();
      uploadTaskRef.current = null;
      setIsUploading(false);
      setPendingAttachment(null);
      setTempFileName("");
      setUploadProgress(0);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const clearAttachment = () => {
      setPendingAttachment(null);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Only allow PDF files
      if (file.type !== "application/pdf") {
        alert("Only PDF files are supported. Please select a PDF document.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setPendingAttachment(null);
      setUploadError(null);
      setIsUploading(true);
      setUploadProgress(0);
      setTempFileName(file.name);

      // Build a unique storage path: chat-attachments/<timestamp>-<filename>
      const fileRef = firebaseRef(
        storage,
        `${BUCKETS.STORED_FILES}/chat-attachments/${Date.now()}-${file.name}`,
      );

      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type,
      });
      uploadTaskRef.current = uploadTask;

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          setUploadProgress(percent);
        },
        (error) => {
          // Upload failed or was cancelled
          const isCancelled = error.code === "storage/canceled";
          if (!isCancelled) {
            console.error("[ChatInput] Firebase Storage upload error:", error);
            setUploadError(
              "Upload failed. Please check your connection and try again.",
            );
          }
          setIsUploading(false);
          setTempFileName("");
          uploadTaskRef.current = null;
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        async () => {
          // Upload succeeded — get the public download URL
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const newAttachment = {
              name: file.name,
              contentType: file.type,
              url: downloadUrl,
            };
            setPendingAttachment(newAttachment);
          } catch (urlError) {
            console.error("[ChatInput] Failed to get download URL:", urlError);
            setUploadError(
              "Upload succeeded but failed to get file URL. Please try again.",
            );
          } finally {
            setIsUploading(false);
            setTempFileName("");
            uploadTaskRef.current = null;
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        },
      );
    };

    const activeFileName = pendingAttachment?.name || tempFileName;

    // --- Voice ---
    const handleGoToVoice = () => router.push("/dashboard/user/voice");

    return (
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
        <div className="max-w-4xl mx-auto">
          {/* ── Upload error banner ── */}
          {uploadError && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
              <AlertCircle size={14} className="shrink-0" />
              <span className="flex-1">{uploadError}</span>
              <button
                onClick={() => setUploadError(null)}
                className="shrink-0 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <AnimatePresence>
            {(pendingAttachment || isUploading) && (
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
                    onClick={isUploading ? cancelUpload : clearAttachment}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-all duration-300 hover:rotate-90 shrink-0"
                    title={isUploading ? "Cancel upload" : "Remove attachment"}
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="application/pdf"
          />

          <div className="relative w-full h-[50px] md:h-[58px]">
            <div
              className={`absolute bottom-0 left-0 w-full flex items-end bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all duration-300 shadow-md z-50 ${
                isInputFocused
                  ? "ring-2 ring-orange-500 border-transparent bg-white dark:bg-slate-800 shadow-orange-500/20"
                  : "focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 mb-1 ml-1 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                  pendingAttachment || isUploading
                    ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700 hover:rotate-12"
                }`}
                title="Upload legal document (PDF)"
                disabled={isUploading || connectionStatus === "offline"}
              >
                <Paperclip size={20} />
              </button>

              <button
                onClick={handleGoToVoice}
                className="p-3 mb-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 hover:-rotate-12"
                title="Start Voice Consultation (Live Overlay)"
                type="button"
                disabled={isUploading || connectionStatus === "offline"}
              >
                <Mic size={20} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendClick();
                  }
                }}
                placeholder={
                  connectionStatus === "offline"
                    ? "Waiting for connection..."
                    : isUploading
                      ? "Uploading document..."
                      : pendingAttachment
                        ? "Describe what you need done with this PDF..."
                        : "Ask about Ugandan Law, or attach a PDF..."
                }
                disabled={
                  isLoading || isUploading || connectionStatus === "offline"
                }
                rows={1}
                name="chat"
                className="w-full py-2 md:py-4 px-2 md:px-4 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-colors min-h-[40px] md:min-h-[56px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 md:text-base text-xs"
              />
              <button
                onClick={handleSendClick}
                disabled={
                  isLoading ||
                  isUploading ||
                  connectionStatus === "offline" ||
                  !input.trim()
                }
                className="p-2 mb-2 mr-2 bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95 hover:rotate-3 disabled:hover:scale-100 disabled:hover:rotate-0"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>
        </div>
        <Disclaimer />
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
