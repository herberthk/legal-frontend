"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  User as UserIcon,
  Scale,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Mic,
  AlertTriangle,
  RefreshCw,
  Server,
  WifiOff,
  Wifi,
  Coins,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthStore } from "@/store";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useRouter } from "nextjs-toploader/app";
import {
  checkUserCanSend,
  createChatSession,
  saveChatMessage,
} from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions/auth";

// --- Helpers to extract content from UIMessage parts ---
const getMessageText = (msg: UIMessage): string => {
  return (
    msg.parts
      ?.filter(
        (
          p,
        ): p is { type: "text"; text: string; state?: "streaming" | "done" } =>
          p.type === "text",
      )
      .map((p) => p.text)
      .join("") || ""
  );
};

const getMessageFile = (
  msg: UIMessage,
): { name: string; type: string; url: string } | undefined => {
  const filePart = msg.parts?.find((p) => p.type === "file");
  if (!filePart || filePart.type !== "file") return undefined;
  return {
    name: filePart.filename || "Attached Document",
    type: filePart.mediaType,
    url: filePart.url,
  };
};

const isMessageStreaming = (msg: UIMessage): boolean => {
  return (
    msg.parts?.some(
      (p) =>
        p.type === "text" && (p as { state?: string }).state === "streaming",
    ) ?? false
  );
};

const ChatInterface = () => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  // --- Chat Session State ---
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);

  // --- Connectivity State ---
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connected");
  const [showOnlineBadge, setShowOnlineBadge] = useState(false);

  // --- Upload State ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempFileName, setTempFileName] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    type: string;
    data: string;
  } | null>(null);

  // --- Token Stats State (Session) ---
  const [sessionStats, setSessionStats] = useState({
    textTokens: 0,
    voiceSeconds: 0,
  });

  // --- Error Banner State ---
  const [billingError, setBillingError] = useState<string | null>(null);

  // --- Input Focus State ---
  const [isInputFocused, setIsInputFocused] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReaderRef = useRef<FileReader | null>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual input state
  const [input, setInput] = useState("");

  /**
   * Ensures a chat session exists. Creates one if needed.
   * Returns the session ID.
   */
  const ensureChatSession = async (firstMessageText: string): Promise<string | null> => {
    if (chatSessionId) return chatSessionId;
    if (!user?.id) return null;

    const result = await createChatSession(user.id, firstMessageText);
    if (result.success && result.sessionId) {
      setChatSessionId(result.sessionId);
      return result.sessionId;
    }
    return null;
  };

  /**
   * Refreshes user state from the server to reflect deductions.
   */
  const refreshUser = async () => {
    try {
      const freshUser = await getCurrentUser();
      if (freshUser) {
        setUser(freshUser);
      }
    } catch (err) {
      console.error("Error refreshing user:", err);
    }
  };

  // --- Vercel AI SDK useChat ---
  const {
    messages,
    sendMessage,
    status,
    regenerate,
    error: chatError,
    setMessages,
  } = useChat({
    // @ts-ignore - The ai package type definitions omit this property, but it's valid at runtime
    body: { sessionId: chatSessionId },
    messages: [
      {
        id: "0",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Greetings. I am your Legal Adviser specializing in Ugandan Law. How may I assist you with the Constitution, Tax Administration, or Rule of Law today?",
          },
        ],
      },
    ] as UIMessage[],
    onFinish: async ({ message }) => {
      // Update session stats with estimated token count
      const text = getMessageText(message);
      const estimatedTokens = Math.ceil(text.length / 4);
      setSessionStats((prev) => ({
        ...prev,
        textTokens: prev.textTokens + estimatedTokens,
      }));
      // Refresh user state from server to reflect deductions
      await refreshUser();
    },
    onError: (error) => {
      const msg = error.message?.toLowerCase() || "";
      if (
        msg.includes("fetch failed") ||
        msg.includes("network") ||
        msg.includes("failed to fetch")
      ) {
        setConnectionStatus("offline");
      }
      // Handle 403 (insufficient funds) from API route
      if (msg.includes("insufficient funds") || msg.includes("403")) {
        setBillingError(
          "Insufficient funds or free tokens. Please add funds to continue.",
        );
        setTimeout(() => setBillingError(null), 5000);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // --- Connectivity Listener ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionStatus(navigator.onLine ? "connected" : "offline");

    const handleOnline = () => {
      setConnectionStatus("reconnecting");
      setTimeout(() => {
        setConnectionStatus("connected");
        setShowOnlineBadge(true);
        setTimeout(() => setShowOnlineBadge(false), 3000);
      }, 1500);
    };

    const handleOffline = () => {
      setConnectionStatus("offline");
      setShowOnlineBadge(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (connectionStatus === "offline") {
      retryIntervalRef.current = setInterval(() => {
        if (navigator.onLine) {
          handleOnline();
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    };
  }, [connectionStatus]);

  // Cleanup upload timeout on unmount
  useEffect(() => {
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingAttachment, isUploading, isLoading, isInputFocused]);

  // --- Send Message ---
  const handleSend = async (
    manualInput?: string,
    manualAttachment?: { name: string; type: string; data: string },
  ) => {
    if (connectionStatus === "offline") return;
    setBillingError(null);

    const textToSend = manualInput ?? input;
    const attachmentToSend = manualAttachment ?? pendingAttachment;

    // Guard clauses
    if (isLoading) return;
    if (!manualInput && !manualAttachment && isUploading) return;
    if (!textToSend.trim() && !attachmentToSend) return;

    // SERVER-SIDE PRE-FLIGHT: Check if user can send
    if (user?.id && user.role !== "ADMIN") {
      const check = await checkUserCanSend(user.id);
      if (!check.canSend) {
        setBillingError(
          check.reason || "Insufficient funds or free tokens. Please add funds to continue.",
        );
        setTimeout(() => setBillingError(null), 5000);
        return;
      }
    }

    // Ensure we have a chat session
    const sessionId = await ensureChatSession(textToSend);

    // Save user message to Firestore
    if (sessionId) {
      const estimatedTokens = Math.ceil(textToSend.length / 4);
      setSessionStats((prev) => ({
        ...prev,
        textTokens: prev.textTokens + estimatedTokens,
      }));
      saveChatMessage(sessionId, {
        role: "user",
        text: textToSend,
        tokenCount: estimatedTokens,
        ...(attachmentToSend && {
          attachment: {
            name: attachmentToSend.name,
            type: attachmentToSend.type,
            url: "",
          },
        }),
      });
    }

    // Send via Vercel AI SDK
    if (attachmentToSend) {
      const dataUrl = `data:${attachmentToSend.type};base64,${attachmentToSend.data}`;
      sendMessage({
        text: textToSend || "Please summarize this document.",
        files: [
          {
            type: "file" as const,
            mediaType: attachmentToSend.type,
            filename: attachmentToSend.name,
            url: dataUrl,
          },
        ],
      });
    } else {
      sendMessage({ text: textToSend });
    }

    if (!manualInput) setInput("");
    if (!manualAttachment) setPendingAttachment(null);
  };

  // --- Retry ---
  const handleRetry = () => {
    if (connectionStatus === "offline") return;
    regenerate();
  };

  // --- Voice ---
  const handleStartVoice = () => router.push("/dashboard/user/voice");

  // --- File Upload ---
  const cancelUpload = () => {
    if (fileReaderRef.current) fileReaderRef.current.abort();
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    setIsUploading(false);
    setPendingAttachment(null);
    setTempFileName("");
    setUploadProgress(0);
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
        handleSend("Please summarize this document.", newAttachment);
      }, 600);
    };

    reader.onerror = () => {
      setIsUploading(false);
      setTempFileName("");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearAttachment = () => setPendingAttachment(null);
  const activeFileName = pendingAttachment?.name || tempFileName;
  const isImage = pendingAttachment?.type.includes("image") || false;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
      {/* Network Status Banners */}
      <div className="absolute w-full top-0 z-50 transition-all duration-300">
        {connectionStatus === "offline" && (
          <div className="bg-red-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md">
            <WifiOff size={12} className="animate-pulse" />
            <span>No Internet Connection. Retrying...</span>
          </div>
        )}
        {connectionStatus === "reconnecting" && (
          <div className="bg-amber-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md">
            <RefreshCw size={12} className="animate-spin" />
            <span>Restoring Connection...</span>
          </div>
        )}
        {connectionStatus === "connected" && showOnlineBadge && (
          <div className="bg-green-500 text-white text-xs font-bold py-1 px-4 text-center flex justify-center items-center gap-2 shadow-md animate-in slide-in-from-top-0 fade-in duration-300">
            <Wifi size={12} />
            <span>Back Online</span>
          </div>
        )}
        {/* Billing Error Toast */}
        {billingError && (
          <div className="bg-red-600 text-white text-sm font-bold py-2 px-4 text-center flex justify-center items-center gap-2 shadow-lg animate-in slide-in-from-top-0">
            <Coins size={16} />
            <span>{billingError}</span>
          </div>
        )}
        {/* Chat Error Toast */}
        {chatError && !billingError && (
          <div className="bg-red-600 text-white text-sm font-bold py-2 px-4 text-center flex justify-center items-center gap-2 shadow-lg animate-in slide-in-from-top-0">
            <AlertTriangle size={16} />
            <span>
              {chatError.message || "An error occurred. Please try again."}
            </span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 relative pt-8">
        {/* Token/Time Usage Badge */}
        {(sessionStats.textTokens > 0 || sessionStats.voiceSeconds > 0) && (
          <div className="sticky top-0 z-20 flex justify-center mb-6 pointer-events-none">
            <div className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-[10px] font-medium text-slate-500 dark:text-slate-400 shadow-sm flex items-center gap-3">
              {sessionStats.textTokens > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                  <Server size={10} />
                  {sessionStats.textTokens} Tokens
                </span>
              )}
              {sessionStats.textTokens > 0 && sessionStats.voiceSeconds > 0 && (
                <span className="w-px h-3 bg-slate-300 dark:bg-slate-600"></span>
              )}
              {sessionStats.voiceSeconds > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                  <Mic size={10} />
                  {Math.floor(sessionStats.voiceSeconds / 60)}m{" "}
                  {sessionStats.voiceSeconds % 60}s
                </span>
              )}
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, index) => {
            const msgText = getMessageText(msg);
            const msgFile = getMessageFile(msg);
            const msgIsStreaming = isMessageStreaming(msg);
            const isAssistant = msg.role === "assistant";
            const isError =
              isAssistant &&
              (msgText.includes("apologize") ||
                msgText.includes("error") ||
                msgText.includes("offline"));

            return (
              <div
                key={msg.id}
                className={`flex items-start max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-105 ${
                    msg.role === "user"
                      ? "bg-linear-to-br from-amber-500 to-orange-600 ml-3 shadow-md"
                      : isError
                        ? "bg-red-100 dark:bg-red-900/30 mr-3"
                        : "bg-orange-100 dark:bg-orange-900/30 mr-3"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserIcon size={20} className="text-white" />
                  ) : isError ? (
                    <AlertTriangle
                      size={20}
                      className="text-red-600 dark:text-red-500"
                    />
                  ) : (
                    <Scale
                      size={20}
                      className="text-orange-600 dark:text-orange-500"
                    />
                  )}
                </div>

                <div
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-full overflow-hidden`}
                >
                  <div
                    className={`px-6 py-4 rounded-2xl shadow-sm text-sm leading-relaxed w-full transition-all hover:shadow-md ${
                      msg.role === "user"
                        ? "bg-linear-to-br from-amber-500 to-orange-600 text-white rounded-tr-none shadow-orange-500/20"
                        : isError
                          ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-slate-800 dark:text-slate-200 rounded-tl-none"
                          : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                    }`}
                  >
                    {/* File attachment display */}
                    {msgFile && (
                      <div
                        className={`mb-3 p-3 rounded-lg flex items-center space-x-3 ${
                          msg.role === "user"
                            ? "bg-white/10"
                            : "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div
                          className={`p-2 rounded flex items-center justify-center ${msg.role === "user" ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}
                        >
                          {msgFile.type.includes("image") ? (
                            <ImageIcon
                              size={18}
                              className={
                                msg.role === "user"
                                  ? "text-white"
                                  : "text-slate-500"
                              }
                            />
                          ) : (
                            <FileText
                              size={18}
                              className={
                                msg.role === "user"
                                  ? "text-white"
                                  : "text-slate-500"
                              }
                            />
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium truncate text-xs opacity-90 max-w-[200px]">
                            {msgFile.name}
                          </span>
                          <span className="text-[10px] opacity-70">
                            Attached Document
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`prose prose-sm max-w-none wrap-break-word ${msg.role === "user" ? "prose-invert" : "dark:prose-invert"}`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          a: ({ node, ...props }) => (
                            <a
                              className={`underline decoration-1 underline-offset-2 transition-colors font-medium ${
                                msg.role === "user"
                                  ? "text-white decoration-white/50 hover:decoration-white"
                                  : "text-orange-600 dark:text-orange-400 decoration-orange-600/30 dark:decoration-orange-400/30 hover:decoration-orange-600 dark:hover:decoration-orange-400"
                              }`}
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                          code: ({
                            node,
                            className,
                            children,
                            ...props
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          }: any) => {
                            const match = /language-(\w+)/.exec(
                              className || "",
                            );
                            const isInline =
                              !match && !String(children).includes("\n");

                            return isInline ? (
                              <code
                                className={`px-1.5 py-0.5 rounded font-mono text-xs ${
                                  msg.role === "user"
                                    ? "bg-black/20 text-white border border-white/10"
                                    : "bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                }`}
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <div
                                className={`rounded-lg overflow-hidden my-3 border ${
                                  msg.role === "user"
                                    ? "bg-black/20 border-white/10 text-white"
                                    : "bg-slate-900 border-slate-700 text-slate-200"
                                }`}
                              >
                                <div
                                  className={`px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border-b flex items-center justify-between ${
                                    msg.role === "user"
                                      ? "border-white/10 bg-white/5"
                                      : "border-slate-700 bg-slate-950"
                                  }`}
                                >
                                  <span>{match ? match[1] : "code"}</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <pre className="p-3 text-xs font-mono leading-relaxed bg-transparent m-0">
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              </div>
                            );
                          },
                          blockquote: ({ node, ...props }) => (
                            <blockquote
                              className={`border-l-4 pl-4 py-1 my-4 italic ${
                                msg.role === "user"
                                  ? "border-white/40 text-white/90 bg-white/5 rounded-r-lg"
                                  : "border-orange-500/50 text-slate-600 dark:text-slate-400 bg-orange-50/50 dark:bg-orange-900/10 rounded-r-lg"
                              }`}
                              {...props}
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul
                              className={`list-disc pl-5 my-2 space-y-1 ${
                                msg.role === "user"
                                  ? "marker:text-white/70"
                                  : "marker:text-orange-500"
                              }`}
                              {...props}
                            />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              className={`list-decimal pl-5 my-2 space-y-1 ${
                                msg.role === "user"
                                  ? "marker:text-white/70"
                                  : "marker:text-orange-500"
                              }`}
                              {...props}
                            />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="pl-1" {...props} />
                          ),
                          h1: ({ node, ...props }) => (
                            <h1
                              className={`text-xl font-bold mb-3 mt-4 ${msg.role === "user" ? "text-white" : "text-slate-900 dark:text-white"}`}
                              {...props}
                            />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2
                              className={`text-lg font-bold mb-2 mt-3 ${msg.role === "user" ? "text-white" : "text-slate-900 dark:text-white"}`}
                              {...props}
                            />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3
                              className={`text-base font-bold mb-2 mt-3 ${msg.role === "user" ? "text-white" : "text-slate-900 dark:text-white"}`}
                              {...props}
                            />
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4 rounded-lg border border-opacity-20 overflow-hidden shadow-sm">
                              <table
                                className={`min-w-full divide-y ${
                                  msg.role === "user"
                                    ? "divide-white/20 border-white/20"
                                    : "divide-slate-200 dark:divide-slate-700 border-slate-200 dark:border-slate-700"
                                }`}
                                {...props}
                              />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead
                              className={
                                msg.role === "user"
                                  ? "bg-white/10"
                                  : "bg-slate-50 dark:bg-slate-800"
                              }
                              {...props}
                            />
                          ),
                          th: ({ node, ...props }) => (
                            <th
                              className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${
                                msg.role === "user"
                                  ? "text-white/90"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                              {...props}
                            />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody
                              className={`divide-y ${
                                msg.role === "user"
                                  ? "divide-white/10"
                                  : "divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900"
                              }`}
                              {...props}
                            />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr
                              className={
                                msg.role === "user"
                                  ? "hover:bg-white/5 transition-colors"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              }
                              {...props}
                            />
                          ),
                          td: ({ node, ...props }) => (
                            <td
                              className={`px-4 py-2.5 text-sm whitespace-pre-wrap ${
                                msg.role === "user"
                                  ? "text-white"
                                  : "text-slate-600 dark:text-slate-300"
                              }`}
                              {...props}
                            />
                          ),
                        }}
                      >
                        {msgText}
                      </ReactMarkdown>
                      {msgIsStreaming && (
                        <span
                          className={`inline-block w-1.5 h-4 ml-1 animate-pulse align-middle rounded-sm ${
                            msg.role === "user"
                              ? "bg-white"
                              : "bg-orange-500 dark:bg-orange-400"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {isError && !isLoading && index === messages.length - 1 && (
                      <button
                        onClick={handleRetry}
                        disabled={connectionStatus === "offline"}
                        className="mt-3 flex items-center space-x-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors bg-white/50 dark:bg-black/10 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={12} />
                        <span>
                          {connectionStatus === "offline"
                            ? "Connect to retry"
                            : "Retry Request"}
                        </span>
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 mt-2 mx-1">
                    {(
                      msg.metadata as { createdAt?: Date } | undefined
                    )?.createdAt?.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }) ??
                      new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-start mr-auto max-w-3xl animate-in fade-in duration-300">
              <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 mr-3">
                <Scale
                  size={20}
                  className="text-orange-600 dark:text-orange-500"
                />
              </div>
              <div className="px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none flex items-center space-x-1 h-[54px]">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
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
                      isInputFocused
                        ? "max-h-0 opacity-0"
                        : "max-h-5 opacity-100"
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
              onClick={handleStartVoice}
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
                  handleSend();
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
              onClick={() => handleSend()}
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
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3 transition-colors hover:text-slate-600 dark:hover:text-slate-400">
          AI Legal Adviser can make mistakes. Please consult a human lawyer for
          official representation.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
