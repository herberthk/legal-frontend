import {
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import React, { FC, useState, useRef, useEffect } from "react";
import Disclaimer from "./Disclaimer";
import { useRouter } from "nextjs-toploader/app";
type ChatInputProps = {
  onSend: (
    text: string,
    attachment?: { name: string; type: string; data: string },
  ) => void;

  connectionStatus: string;
  isLoading: boolean;
  onHeightChange?: () => void;
};

const ChatInput: FC<ChatInputProps> = ({
  onSend,

  connectionStatus,
  isLoading,
  onHeightChange,
}) => {
  const [input, setInput] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempFileName, setTempFileName] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    type: string;
    data: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReaderRef = useRef<FileReader | null>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  // Notify parent of layout/height changes for auto-scroll
  useEffect(() => {
    onHeightChange?.();
  }, [input, isUploading, pendingAttachment, isInputFocused, onHeightChange]);

  // Cleanup upload timeout on unmount
  useEffect(() => {
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
      if (fileReaderRef.current) {
        fileReaderRef.current.abort();
      }
    };
  }, []);

  const handleSendClick = () => {
    if (
      isLoading ||
      isUploading ||
      connectionStatus === "offline" ||
      (!input.trim() && !pendingAttachment)
    ) {
      return;
    }

    onSend(input, pendingAttachment || undefined);
    setInput("");
    setPendingAttachment(null);
  };

  const cancelUpload = () => {
    if (fileReaderRef.current) fileReaderRef.current.abort();
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    setIsUploading(false);
    setPendingAttachment(null);
    setTempFileName("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearAttachment = () => {
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingAttachment(null);
    setIsUploading(true);
    setUploadProgress(0);
    setTempFileName(file.name);

    const reader = new FileReader();
    fileReaderRef.current = reader;

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    reader.onload = (evt) => {
      uploadTimeoutRef.current = setTimeout(() => {
        const result = evt.target?.result as string;
        const base64Data = result.split(",")[1];
        const newAttachment = {
          name: file.name,
          type: file.type,
          data: base64Data,
        };
        setIsUploading(false);
        setTempFileName("");
        fileReaderRef.current = null;

        // Auto-send upon finishing upload, mimicking the previous behaviour
        onSend("Please summarize this document.", newAttachment);

        // Reset file input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 600);
    };

    reader.onerror = () => {
      setIsUploading(false);
      setTempFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsDataURL(file);
  };

  const activeFileName = pendingAttachment?.name || tempFileName;
  const isImage = pendingAttachment?.type.includes("image") || false;

  // --- Voice ---
  const handleGoToVoice = () => router.push("/dashboard/user/voice");
  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto">
        {(pendingAttachment || isUploading) && (
          <div
            className={`transform transition-all duration-300 ease-in-out origin-bottom ${
              isInputFocused
                ? "mb-1 opacity-80 scale-[0.98]"
                : "mb-3 opacity-100 scale-100"
            }`}
          >
            <div
              className={`flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl relative overflow-hidden transition-all duration-300 hover:shadow-md ${
                isInputFocused ? "p-2" : "p-3"
              }`}
            >
              {isUploading && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-linear-to-r from-amber-500 to-orange-600 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              )}

              <div
                className={`bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 flex items-center justify-center text-orange-500 shadow-sm mr-3 shrink-0 transition-all duration-300 ${
                  isInputFocused ? "h-8 w-8" : "h-10 w-10"
                }`}
              >
                {isUploading ? (
                  <Loader2
                    size={isInputFocused ? 16 : 20}
                    className="animate-spin text-slate-400"
                  />
                ) : isImage ? (
                  <ImageIcon size={isInputFocused ? 16 : 20} />
                ) : (
                  <FileText size={isInputFocused ? 16 : 20} />
                )}
              </div>

              <div className="flex-1 min-w-0 mr-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {activeFileName}
                  </span>
                  {isUploading ? (
                    <span className="text-xs text-slate-500 font-medium">
                      {uploadProgress}%
                    </span>
                  ) : (
                    <span className="flex items-center text-xs text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 size={12} className="mr-1" /> Ready
                    </span>
                  )}
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isInputFocused ? "max-h-0 opacity-0" : "max-h-5 opacity-100"
                  }`}
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {isUploading
                      ? "Processing document..."
                      : "Document attached for analysis"}
                  </p>
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
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="application/pdf,image/*"
        />

        <div
          className={`relative flex items-end bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all duration-300 shadow-sm ${
            isInputFocused
              ? "ring-2 ring-orange-500 border-transparent bg-white dark:bg-slate-800 shadow-orange-500/10"
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
            title="Upload legal document (PDF, Image)"
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
                  : "Ask about Ugandan Law, or attach a PDF/Image..."
            }
            disabled={
              isLoading || isUploading || connectionStatus === "offline"
            }
            rows={1}
            name="chat"
            className="w-full py-4 px-2 bg-transparent border-none focus:ring-0 focus:outline-none resize-none max-h-32 text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-colors"
            style={{ minHeight: "56px" }}
          />
          <button
            onClick={handleSendClick}
            disabled={
              isLoading ||
              isUploading ||
              connectionStatus === "offline" ||
              (!input.trim() && !pendingAttachment)
            }
            className="p-2.5 mb-2 mr-2 bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95 hover:rotate-3 disabled:hover:scale-100 disabled:hover:rotate-0"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
};

export default ChatInput;
