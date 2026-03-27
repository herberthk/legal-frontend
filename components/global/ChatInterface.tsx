"use client";
import React, { useState, useRef, useEffect, useLayoutEffect, FC } from "react";
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
  Sparkles,
} from "lucide-react";

import MakdownFormater from "./MakdownFormater";
import { useAuthStore } from "@/store";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { createChatSession, getChatMessages } from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions/auth";
import { DefaultChatTransport, generateId } from "ai";
import ChatInput from "./ChatInput";
import BillingError from "./modal/BillingError";
import ChatError from "./modal/ChatError";
import { checkCanSend } from "@/lib";
import {
  getMessageFile,
  getMessageReasoning,
  getMessageText,
  isMessageStreaming,
  isReasoningStreaming,
  ThinkingBlock,
} from "./chat-hepers";

const ChatInterface: FC<ChatInterfaceProps> = ({
  chatId,
  onChatCreated,
  serverChatId,
  serverMessages,
}) => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // --- Chat Session State ---
  const [chatSessionId, setChatSessionId] = useState<string | null>(
    chatId || null,
  );
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // --- Connectivity State ---
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connected");
  const [showOnlineBadge, setShowOnlineBadge] = useState(false);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Holds the latest chatSessionId synchronously — never stale even within the
  // same render tick as setChatSessionId.
  const chatSessionIdRef = useRef<string | null>(chatId || null);
  // Tracks the ID of the chat that was auto-triggered to prevent loading its history
  const autoTriggeredChatIdRef = useRef<string | null>(null);

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
    return { messages: [], tokens: 0 };
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
        setMessages([]);
        setSessionStats({ textTokens: 0, voiceSeconds: 0 });
        return;
      }

      // messages is already populated (from initialMessages or a previous load)
      if (chatId === chatSessionId && messages.length > 1) return;

      // Auto-trigger handles the brand-new session case — don't race with it
      if (
        sessionStorage.getItem(`chat_pending_${chatId}`) ||
        autoTriggeredChatIdRef.current === chatId
      ) {
        return;
      }

      // The current chatId matches what was SSR-prefetched: trust the serverMessages
      // (even if empty) to avoid a redundant client-side fetch.
      if (chatId === serverChatId && serverMessages) {
        setChatSessionId(chatId);
        const totalTokens = serverMessages.reduce(
          (sum: number, m: { tokenCount?: number }) =>
            sum + (m.tokenCount || 0),
          0,
        );
        setSessionStats((prev) => ({ ...prev, textTokens: totalTokens }));
        
        // If there are messages, we don't need to do anything else as they 
        // were already seeded via useLayoutEffect + setMessages.
        return;
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
          setMessages([]);
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
    if (!chatId || autoTriggeredChatIdRef.current === chatId) return;

    const pendingKey = `chat_pending_${chatId}`;
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return;

    autoTriggeredChatIdRef.current = chatId;
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
          text: pending.text,
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

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // --- Send Message ---
  const handleSend = async (
    textToSend: string,
    attachmentToSend?: { name: string; type: string; data: string },
  ) => {
    if (connectionStatus === "offline") return;
    setBillingError(null);

    // Check if user can send message
    const canSend = await checkCanSend(user?.id || "");
    if (!canSend.canSend) {
      showBillingBanner(
        canSend.reason ??
          "Insufficient funds or free tokens. Please add funds to continue.",
      );
      return;
    }

    // Guard clauses
    if (isLoading) return;
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
        text: textToSend,
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
  };

  // --- Retry ---
  const handleRetry = () => {
    if (connectionStatus === "offline") return;
    regenerate();
  };

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
        <div className="max-w-4xl flex-1 mx-auto flex flex-col justify-end min-h-full w-full">
          {/* ── HERO WELCOME SCREEN (Only visible on new, empty chat) ── */}
          {messages.length === 0 && !chatId && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500 pb-10 mt-auto mb-auto">
              <div className="w-20 h-20 bg-linear-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center shadow-xl mb-8 transform hover:scale-105 transition-transform duration-300">
                <Scale
                  size={40}
                  className="text-white drop-shadow-md"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                Good{" "}
                {new Date().getHours() < 12
                  ? "morning"
                  : new Date().getHours() < 18
                    ? "afternoon"
                    : "evening"}
                , {user?.name?.split(" ")[0] || "there"}
              </h1>
              <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12">
                I am your Legal Adviser specifically trained on Ugandan Law. How
                can I help you today?
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                {[
                  {
                    icon: <FileText size={20} className="text-blue-500" />,
                    title: "Review a document",
                    subtitle: "Upload a contract or agreement for analysis",
                    prompt:
                      "Please review this document and summarize the key clauses, potential risks, and obligations.",
                  },
                  {
                    icon: <Scale size={20} className="text-orange-500" />,
                    title: "Constitutional Law",
                    subtitle: "Questions about rights and governance",
                    prompt:
                      "Explain the fundamental human rights guaranteed under Chapter Four of the Constitution of Uganda.",
                  },
                  {
                    icon: (
                      <AlertTriangle size={20} className="text-amber-500" />
                    ),
                    title: "Tax Administration",
                    subtitle: "Compliance and URA regulations",
                    prompt:
                      "What are the penalties for late filing of income tax returns under the Tax Procedures Code Act?",
                  },
                  {
                    icon: <UserIcon size={20} className="text-emerald-500" />,
                    title: "Employment Law",
                    subtitle: "Worker rights and termination",
                    prompt:
                      "What is the legally required notice period for terminating an employee who has worked for 5 years?",
                  },
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(suggestion.prompt)}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-orange-500/50 dark:hover:border-orange-500/50 hover:shadow-md transition-all text-left group flex items-start gap-4"
                  >
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 group-hover:scale-110 transition-transform">
                      {suggestion.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {suggestion.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {suggestion.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STANDARD CHAT MESSAGE LOOP ── */}
          <div className="space-y-6 w-full">
            {messages.map((msg, index) => {
              const msgText = getMessageText(msg);
              const msgReasoning = getMessageReasoning(msg);
              const msgFile = getMessageFile(msg);
              const msgIsStreaming = isMessageStreaming(msg);
              const msgReasoningStreaming = isReasoningStreaming(msg);
              const isAssistant = msg.role === "assistant";

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
                        : chatError
                          ? "bg-red-100 dark:bg-red-900/30 mr-3"
                          : "bg-orange-100 dark:bg-orange-900/30 mr-3"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <UserIcon size={20} className="text-white" />
                    ) : chatError ? (
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
                    {/* Reasoning / Thinking Block — only for assistant messages */}
                    {isAssistant && msgReasoning && (
                      <ThinkingBlock
                        reasoning={msgReasoning}
                        isStreaming={msgReasoningStreaming}
                      />
                    )}

                    {/* Message container */}
                    {(msg.role === "user" || msgText.length > 0 || !!msgFile || !msgReasoning || !msgReasoningStreaming) && (
                      <div
                        className={`px-6 py-4 rounded-2xl shadow-sm text-sm leading-relaxed w-full transition-all hover:shadow-md ${
                          msg.role === "user"
                            ? "bg-linear-to-br from-amber-500 to-orange-600 text-white rounded-tr-none shadow-orange-500/20"
                            : chatError
                              ? "bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-slate-800 dark:text-slate-200 rounded-tl-none"
                              : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none"
                        } ${(isAssistant && msgReasoning) ? "rounded-tl-none mt-2" : ""}`}
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
                          <MakdownFormater
                            content={msgText}
                            role={
                              msg.role as "user" | "assistant" | "system" | "data"
                            }
                            isStreaming={msgIsStreaming}
                          />
                        </div>

                          {chatError &&
                            !isLoading &&
                            index === messages.length - 1 && (
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
                    )}
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
                {status === "submitted" ? (
                  // Waiting for first token — show thinking indicator perfectly matching ThinkingBlock
                  <div className="w-[200px] rounded-tl-xl rounded-tr-xl border border-orange-200/60 dark:border-orange-800/40 bg-orange-50/50 dark:bg-orange-950/20 overflow-hidden">
                    <div className="w-full flex items-center gap-2 px-3 py-2 text-left bg-transparent">
                      <Sparkles
                        size={13}
                        className="shrink-0 text-orange-500 animate-pulse"
                      />
                      <span className="flex-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 tracking-wide uppercase">
                        Thinking…
                      </span>
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1 h-1 rounded-full bg-orange-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                ) : (
                  // Streaming — wait for text to begin or reasoning logic to take over
                  <div className="px-6 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-none flex items-center space-x-1 h-[54px]">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSend}
        connectionStatus={connectionStatus}
        isLoading={isLoading}
        onHeightChange={scrollToBottom}
      />
    </div>
  );
};

export default ChatInterface;
