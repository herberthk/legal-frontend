"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  User as UserIcon,
  Scale,
  FileText,
  Image as ImageIcon,
  Mic,
  AlertTriangle,
  RefreshCw,
  Server,
  WifiOff,
  Wifi,
  ServerCrash,
  X,
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
  getChatMessages,
} from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions/auth";
import { DefaultChatTransport, generateId } from "ai";
import ChatInput from "./ChatInput";
import BillingError from "./modal/BillingError";
import ChatError from "./modal/ChatError";

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

interface ChatInterfaceProps {
  chatId?: string | null;
  onChatCreated?: (chatId: string) => void;
  serverChatId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverMessages?: any[] | null;
}

const ChatInterface = ({
  chatId,
  onChatCreated,
  serverChatId,
  serverMessages,
}: ChatInterfaceProps) => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  // --- Chat Session State ---
  const [chatSessionId, setChatSessionId] = useState<string | null>(
    chatId || null,
  );
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

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

  // --- Billing & Error Banner State ---
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingBannerVisible, setBillingBannerVisible] = useState(false);
  const [chatErrorBannerVisible, setChatErrorBannerVisible] = useState(false);

  const showBillingBanner = (msg: string) => {
    setBillingError(msg);
    setBillingBannerVisible(true);
  };
  const dismissBillingBanner = () => setBillingBannerVisible(false);
  const dismissChatErrorBanner = () => setChatErrorBannerVisible(false);

  // --- Input Focus State ---
  const [isInputFocused, setIsInputFocused] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReaderRef = useRef<FileReader | null>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Holds the latest chatSessionId synchronously — never stale even within the
  // same render tick as setChatSessionId.
  const chatSessionIdRef = useRef<string | null>(chatId || null);
  // Prevents the auto-trigger effect from firing more than once per mount.
  const autoTriggeredRef = useRef(false);

  // Manual input state
  const [input, setInput] = useState("");

  /**
   * Ensures a chat session exists. Creates one if needed.
   * Returns the session ID.
   */
  const ensureChatSession = async (
    firstMessageText: string,
  ): Promise<string | null> => {
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

  const initialMessage: UIMessage = {
    id: "0",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Greetings. I am your Legal Adviser specializing in Ugandan Law. How may I assist you with the Constitution, Tax Administration, or Rule of Law today?",
      },
    ],
  };

  const initialHistory = React.useMemo(() => {
    if (
      chatId &&
      serverChatId &&
      chatId === serverChatId &&
      serverMessages &&
      serverMessages.length > 0
    ) {
      let totalTokens = 0;
      const historyMessages: UIMessage[] = serverMessages.map((m) => {
        totalTokens += m.tokenCount || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [{ type: "text", text: m.text }];

        if (m.attachment) {
          parts.push({
            type: "file",
            mediaType: m.attachment.type,
            filename: m.attachment.name,
            url: m.attachment.url || "",
          });
        }

        return {
          id: m.id || generateId(),
          role: m.role,
          parts,
          metadata: { createdAt: new Date(m.createdAt) },
        };
      });
      return { messages: historyMessages, tokens: totalTokens };
    }
    return { messages: [initialMessage], tokens: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only directly on mount so that it populates initial messages synchronously

  // --- Token Stats State (Session) ---
  const [sessionStats, setSessionStats] = useState({
    textTokens: initialHistory.tokens,
    voiceSeconds: 0,
  });
  // console.log("sessionId", chatSessionIdRef.current);
  // --- Vercel AI SDK useChat ---
  const {
    messages,
    sendMessage,
    status,
    regenerate,
    error: chatError,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      // prepareSendMessagesRequest is called right before each fetch, so
      // chatSessionIdRef.current is always the newest value — never stale.
      prepareSendMessagesRequest: ({ messages: msgs, id }) => ({
        headers: {
          "x-chat-id": chatSessionIdRef.current ?? "",
          "x-first-message": !chatSessionId ? "true" : "false",
        },
        body: { messages: msgs, id },
      }),
    }),
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
        showBillingBanner(
          "Insufficient funds or free tokens. Please add funds to continue.",
        );
      } else {
        // Show general error banner
        setChatErrorBannerVisible(true);
      }
    },
  });

  const isLoadingChat = status === "submitted" || status === "streaming";
  const isLoading = isLoadingChat || isFetchingHistory;

  // --- SSR Hydration: populate messages before first paint ---
  // useLayoutEffect runs synchronously before the browser paints, so messages
  // from SSR props are visible immediately — equivalent to initialMessages but
  // compatible with @ai-sdk/react v3 which removed that option.
  useLayoutEffect(() => {
    if (initialHistory.messages.length > 0) {
      setMessages(initialHistory.messages);
    }
    if (initialHistory.tokens > 0) {
      setSessionStats((prev) => ({
        ...prev,
        textTokens: initialHistory.tokens,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — initialHistory is stable (useMemo with [] deps)

  // --- Fetch Chat History ---
  // Only needed when navigating to a chat that was NOT server-side prefetched
  // (e.g. switching chats via the sidebar after initial load). When useChat
  // is seeded with initialMessages the effect short-circuits immediately.
  useEffect(() => {
    const loadChatHistory = async () => {
      // Reset to blank when there is no active chat
      if (!chatId) {
        setChatSessionId(null);
        setMessages([initialMessage]);
        setSessionStats({ textTokens: 0, voiceSeconds: 0 });
        return;
      }

      // messages is already populated (from initialMessages or a previous load)
      if (chatId === chatSessionId && messages.length > 1) return;

      // Auto-trigger handles the brand-new session case — don't race with it
      if (sessionStorage.getItem(`chat_pending_${chatId}`)) return;

      // The current chatId matches what was SSR-prefetched: initialMessages
      // already holds the data, just sync the session-ID state.
      if (
        chatId === serverChatId &&
        serverMessages &&
        serverMessages.length > 0
      ) {
        setChatSessionId(chatId);
        const totalTokens = serverMessages.reduce(
          (sum: number, m: { tokenCount?: number }) =>
            sum + (m.tokenCount || 0),
          0,
        );
        setSessionStats((prev) => ({ ...prev, textTokens: totalTokens }));
        return; // initialMessages already has these messages — no setMessages needed
      }

      // Fallback: fetch from Firestore (sidebar navigation to a non-prefetched chat)
      setIsFetchingHistory(true);
      setChatSessionId(chatId);

      try {
        const result = await getChatMessages(chatId);
        if (result.success && result.messages && result.messages.length > 0) {
          let totalTokens = 0;
          const historyMessages: UIMessage[] = result.messages.map((m) => {
            totalTokens += m.tokenCount || 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parts: any[] = [{ type: "text", text: m.text }];
            if (m.attachment) {
              parts.push({
                type: "file",
                mediaType: m.attachment.type,
                filename: m.attachment.name,
                url: m.attachment.url || "",
              });
            }
            return {
              id: m.id || generateId(),
              role: m.role,
              parts,
              metadata: { createdAt: new Date(m.createdAt) },
            };
          });
          setSessionStats((prev) => ({ ...prev, textTokens: totalTokens }));
          setMessages(historyMessages);
        } else {
          setMessages([initialMessage]);
          setSessionStats({ textTokens: 0, voiceSeconds: 0 });
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // --- Auto-trigger AI for newly created chats ---
  useEffect(() => {
    if (!chatId || autoTriggeredRef.current) return;

    const pendingKey = `chat_pending_${chatId}`;
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return;

    autoTriggeredRef.current = true;
    sessionStorage.removeItem(pendingKey);

    try {
      const pending: {
        text: string;
        estimatedTokens: number;
        attachment?: { name: string; type: string; data: string };
      } = JSON.parse(raw);

      chatSessionIdRef.current = chatId;
      setChatSessionId(chatId);
      setSessionStats((prev) => ({
        ...prev,
        textTokens: prev.textTokens + pending.estimatedTokens,
      }));

      // Clear any greeting/stale messages that initialMessages may have set
      // so the user bubble and AI stream start on a clean slate.
      setMessages([]);

      // sendMessage adds the user bubble and starts the AI stream
      if (pending.attachment) {
        const dataUrl = `data:${pending.attachment.type};base64,${pending.attachment.data}`;
        sendMessage({
          text: pending.text || "Please summarize this document.",
          files: [
            {
              type: "file" as const,
              mediaType: pending.attachment.type,
              filename: pending.attachment.name,
              url: dataUrl,
            },
          ],
        });
      } else {
        sendMessage({ text: pending.text });
      }
    } catch {
      sessionStorage.removeItem(`chat_pending_${chatId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only: chatId is stable for the lifetime of this component

  // --- Connectivity Listener ---
  useEffect(() => {
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

    // Check if user can send message
    const canSend = await checkUserCanSend(user?.id || "");
    if (!canSend.canSend) {
      showBillingBanner(
        canSend.reason ??
          "Insufficient funds or free tokens. Please add funds to continue.",
      );
      return;
    }

    const textToSend = manualInput ?? input;
    const attachmentToSend = manualAttachment ?? pendingAttachment;

    // Guard clauses
    if (isLoading) return;
    if (!manualInput && !manualAttachment && isUploading) return;
    if (!textToSend.trim() && !attachmentToSend) return;

    // Track whether this is a brand-new session BEFORE any async work
    const isNewSession = !chatSessionId;

    // Ensure we have a chat session
    const sessionId = await ensureChatSession(textToSend);
    if (!sessionId) return;

    // Update ref immediately — React state won't settle until next render
    chatSessionIdRef.current = sessionId;
    setChatSessionId(sessionId);

    const estimatedTokens = Math.ceil(textToSend.length / 4);
    setSessionStats((prev) => ({
      ...prev,
      textTokens: prev.textTokens + estimatedTokens,
    }));

    if (isNewSession) {
      // ── NEW CHAT ──────────────────────────────────────────────────────────
      // Store the pending message so the destination page can pick it up and
      // fire the AI call itself. This gives us ChatGPT-style behaviour:
      //   navigate first → stream on the correct URL.
      sessionStorage.setItem(
        `chat_pending_${sessionId}`,
        JSON.stringify({
          text: textToSend,
          estimatedTokens,
          attachment: attachmentToSend ?? null,
        }),
      );

      if (!manualInput) setInput("");
      if (!manualAttachment) setPendingAttachment(null);

      // Navigate — the auto-trigger effect on the new page handles the rest
      if (onChatCreated) onChatCreated(sessionId);
      return;
    }

    // ── EXISTING CHAT ────────────────────────────────────────────────────────
    // Send via Vercel AI SDK (adds user bubble + triggers stream)
    // console.log("attachmentToSend", attachmentToSend);
    // console.log("textToSend", textToSend);
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
        {/* ── Billing Insufficient-Funds Banner ─────────────────────────── */}
        {billingBannerVisible && billingError && (
          <BillingError
            billingError={billingError}
            dismissBillingBanner={dismissBillingBanner}
          />
        )}
        {/* ── Chat Error Banner ─────────────────────────────────────────── */}
        {chatErrorBannerVisible && chatError && !billingError && (
          <ChatError
            chatError={chatError}
            dismissChatErrorBanner={dismissChatErrorBanner}
            handleRetry={handleRetry}
          />
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 relative pt-8 md:pt-6">
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
      <ChatInput
        clearAttachment={clearAttachment}
        cancelUpload={cancelUpload}
        input={input}
        setInput={setInput}
        pendingAttachment={pendingAttachment}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        handleSend={handleSend}
        handleStartVoice={handleStartVoice}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        connectionStatus={connectionStatus}
        isLoading={isLoading}
        activeFileName={activeFileName}
        isImage={isImage}
      />
    </div>
  );
};

export default ChatInterface;
