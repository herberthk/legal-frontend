import {
  AlertCircle,
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
import { ChatDeleteModal } from "./ChatDeleteModal";
import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { useRouter } from "nextjs-toploader/app";
import { AnimatePresence } from "framer-motion";
import { logAnalyticsEvent, storage } from "@/firebase/client";
import {
  ref as firebaseRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    const clearAttachment = useCallback(async () => {
      setShowDeleteConfirm(false);
      if (pendingAttachment?.url) {
        try {
          // Delete the uploaded file from Firebase Storage to prevent orphaned files
          const fileRefToDiscard = firebaseRef(storage, pendingAttachment.url);
          await deleteObject(fileRefToDiscard);
        } catch (err) {
          console.error("[ChatInput] Failed to delete discarded attachment:", err);
        }
      }
      setPendingAttachment(null);
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, [pendingAttachment]);

    const openDeleteConfirm = useCallback(() => setShowDeleteConfirm(true), []);
    const closeDeleteConfirm = useCallback(() => setShowDeleteConfirm(false), []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Only allow PDF and image files
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        alert("Only PDF, DOCX, and image files are supported.");
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
    const handleGoToVoice = () => router.push("/dashboard/voice");

    return (
      <div className="md:p-4 p-1 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
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
              <ChatAttachmentPreview
                isUploading={isUploading}
                isInputFocused={isInputFocused}
                uploadProgress={uploadProgress}
                activeFileName={activeFileName}
                onCancelUpload={cancelUpload}
                onRemoveAttachment={openDeleteConfirm}
              />
            )}
          </AnimatePresence>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, image/png, image/jpeg, image/jpg, image/webp"
          />

          <div className="relative w-full h-12.5 md:h-14.5">
            <div
              className={`absolute bottom-0 left-0 w-full flex items-end bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all duration-300 shadow-md z-50 ${
                isInputFocused
                  ? "ring-2 ring-orange-500 border-transparent bg-white dark:bg-slate-800 shadow-orange-500/20"
                  : "focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`md:p-3 p-1 mb-1 ml-1 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                  pendingAttachment || isUploading
                    ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700 hover:rotate-12"
                }`}
                title="Upload document or image"
                disabled={isUploading || connectionStatus === "offline"}
              >
                <Paperclip size={18} />
              </button>

              <button
                onClick={handleGoToVoice}
                className="md:p-3 p-1 mb-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-95 hover:-rotate-12"
                title="Start Voice Consultation (Live Overlay)"
                type="button"
                disabled={isUploading || connectionStatus === "offline"}
              >
                <Mic size={18} />
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
                className="w-full py-2 md:py-4 px-2 md:px-4 bg-transparent border-none focus:ring-0 focus:outline-none resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-colors md:min-h-14 min-h-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 md:text-base text-[11px] text-center"
              />
              <button
                onClick={handleSendClick}
                disabled={
                  isLoading ||
                  isUploading ||
                  connectionStatus === "offline" ||
                  !input.trim()
                }
                className="md:p-2 p-1 md:mb-2 mb-1 mr-2 bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95 hover:rotate-3 disabled:hover:scale-100 disabled:hover:rotate-0"
              >
                {isLoading ? (
                  <div className="md:w-5 md:h-5 w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
        <Disclaimer />

        <ChatDeleteModal
          isOpen={showDeleteConfirm}
          onClose={closeDeleteConfirm}
          onConfirm={clearAttachment}
        />
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
