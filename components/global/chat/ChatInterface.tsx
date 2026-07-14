"use client";
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  FC,
} from "react";
import { flushSync } from "react-dom";
import { Scale, Sparkles, Loader2 } from "lucide-react";

import { useAuthStore } from "@/store";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { createChatSession, getChatMessages } from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions/auth";
import { DefaultChatTransport, generateId } from "ai";
import ChatInput, { ChatInputRef } from "./ChatInput";
import { checkCanSend } from "@/lib";
import { getMessageText } from "./chat-hepers";
import { ChatHero } from "./ChatHero";
import { ChatMessage } from "./ChatMessage";
import { ChatStatusBanners } from "./ChatStatusBanners";
import { ChatTokenUsageBadge } from "./ChatTokenUsageBadge";

const ChatInterface: FC<ChatInterfaceProps> = ({
  chatId,
  onChatCreated,
  serverChatId,
  serverMessages,
  serverHasMore,
}) => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  // --- Chat Session State ---
  const [chatSessionId, setChatSessionId] = useState<string | null>(
    chatId || null,
  );
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  // Infinite scroll state
  const [hasMore, setHasMore] = useState(serverHasMore ?? false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Connectivity State ---
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connected");
  const [showOnlineBadge, setShowOnlineBadge] = useState(false);

  // --- Billing & Error Banner State ---
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingBannerVisible, setBillingBannerVisible] = useState(false);
  const [chatErrorBannerVisible, setChatErrorBannerVisible] = useState(false);

  const showBillingBanner = useCallback((msg: string) => {
    setBillingError(msg);
    setBillingBannerVisible(true);
  }, []);
  const dismissBillingBanner = useCallback(
    () => setBillingBannerVisible(false),
    [],
  );
  const dismissChatErrorBanner = useCallback(
    () => setChatErrorBannerVisible(false),
    [],
  );

  // --- Input Focus State ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
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
            mediaType: m.attachment.contentType,
            filename: m.attachment.name,
            url: m.attachment.url || "",
          });
        }

        return {
          id: m.id || generateId(),
          role: m.role,
          parts,
          metadata: { createdAt: m.createdAt },
        };
      });
      return { messages: historyMessages, tokens: totalTokens };
    }
    return { messages: [], tokens: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only directly on mount so that it populates initial messages synchronously

  /** Helper: convert a raw ChatMessageRecord into a UIMessage */
  const toUIMessage = useCallback((m: ChatMessageRecord): UIMessage => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ type: "text", text: m.text }];
    if (m.attachment) {
      parts.push({
        type: "file",
        mediaType: m.attachment.contentType,
        filename: m.attachment.name,
        url: m.attachment.url || "",
      });
    }
    return {
      id: m.id || generateId(),
      role: m.role,
      parts,
      metadata: { createdAt: m.createdAt },
    };
  }, []);

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

  // --- Infinite Scroll: load older messages on scroll-up ---
  const loadOlderMessages = useCallback(async () => {
    if (!chatSessionId || isLoadingMore || !hasMore) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const oldestMsg = messages[0];
    const oldestId = oldestMsg?.id;
    const oldestCreatedAt = (oldestMsg?.metadata as { createdAt?: string })?.createdAt;

    if (!oldestId || !oldestCreatedAt) return;

    setIsLoadingMore(true);

    try {
      const result = await getChatMessages(chatSessionId, 10, { 
        id: oldestId, 
        createdAt: oldestCreatedAt 
      });

      if (result.success && result.messages && result.messages.length > 0) {
        const older: UIMessage[] = result.messages.map(toUIMessage);
        
        // Snapshot scroll position right before the synchronous DOM mutation
        const prevScrollHeight = container.scrollHeight;
        const prevScrollTop = container.scrollTop;

        // Force synchronous render of the new messages
        flushSync(() => {
          setMessages((current) => [...older, ...current]);
          setHasMore(result.hasMore ?? false);
        });

        // The DOM is now updated. Restore scroll position seamlessly.
        container.scrollTop = prevScrollTop + (container.scrollHeight - prevScrollHeight);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load older messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatSessionId, hasMore, isLoadingMore, messages, toUIMessage]);

  // Attach scroll listener to the messages container
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      // Infinite scroll: load older messages when near top
      if (container.scrollTop < 80 && hasMore && !isLoadingMore) {
        loadOlderMessages();
      }

      // Skip updating isNearBottom when WE triggered the scroll (scrollIntoView)
      if (isProgrammaticScrollRef.current) return;

      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      isNearBottomRef.current = isNearBottom;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [hasMore, isLoadingMore, loadOlderMessages]);

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
        // Seed hasMore from the page prop
        if (typeof serverHasMore === "boolean") {
          setHasMore(serverHasMore);
        }

        // If there are messages, we don't need to do anything else as they
        // were already seeded via useLayoutEffect + setMessages.
        return;
      }

      // Fallback: fetch from Firestore (sidebar navigation to a non-prefetched chat)
      setIsFetchingHistory(true);
      setChatSessionId(chatId);

      try {
        const result = await getChatMessages(chatId);
        console.log("Messages",result.messages.length)
        if (result.success && result.messages && result.messages.length > 0) {
          let totalTokens = 0;
          const historyMessages: UIMessage[] = result.messages.map((m) => {
            totalTokens += m.tokenCount || 0;
            return toUIMessage(m);
          });
          setSessionStats((prev) => ({ ...prev, textTokens: totalTokens }));
          setMessages(historyMessages);
          setHasMore(result.hasMore ?? false);
        } else {
          setMessages([]);
          setSessionStats({ textTokens: 0, voiceSeconds: 0 });
          setHasMore(false);
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
        attachment?: { name: string; contentType: string; url: string };
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
        sendMessage({
          text: pending.text,
          files: [
            {
              type: "file" as const,
              mediaType: pending.attachment.contentType,
              filename: pending.attachment.name,
              url: pending.attachment.url, // Firebase Storage HTTPS URL
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
  const isInitialScroll = useRef(true);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !isInitialScroll.current && !isNearBottomRef.current) return;

    // Mark the next scroll events as programmatic so the listener doesn't
    // reset isNearBottomRef back to true when the user is reading history.
    isProgrammaticScrollRef.current = true;

    messagesEndRef.current?.scrollIntoView({ 
      behavior: isInitialScroll.current ? "auto" : "smooth" 
    });
    isInitialScroll.current = false;

    // Clear the flag after the browser has finished the scroll
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, []);

  useEffect(() => {
    // A small delay ensures the DOM has painted the messages before scrolling
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, isLoading, scrollToBottom]);

  // --- Send Message ---
  const handleSend = async (
    textToSend: string,
    attachmentToSend?: { name: string; contentType: string; url: string },
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
          // Store the Firebase Storage URL shape — no base64
          attachment: attachmentToSend ?? null,
        }),
      );

      // Navigate — the auto-trigger effect on the new page handles the rest
      if (onChatCreated) onChatCreated(sessionId);
      return;
    }

    // ── EXISTING CHAT ────────────────────────────────────────────────────────
    // Force scroll to bottom for the new message
    isNearBottomRef.current = true;

    // Send via Vercel AI SDK (adds user bubble + triggers stream)
    if (attachmentToSend) {
      sendMessage({
        text: textToSend,
        files: [
          {
            type: "file" as const,
            mediaType: attachmentToSend.contentType,
            filename: attachmentToSend.name,
            url: attachmentToSend.url, // Firebase Storage HTTPS URL
          },
        ],
      });
    } else {
      sendMessage({ text: textToSend });
    }
  };

  // --- Retry ---
  const handleRetry = useCallback(() => {
    if (connectionStatus === "offline") return;
    regenerate();
  }, [connectionStatus, regenerate]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
      {/* Network Status Banners */}
      <ChatStatusBanners
        connectionStatus={connectionStatus}
        showOnlineBadge={showOnlineBadge}
        billingBannerVisible={billingBannerVisible}
        billingError={billingError}
        dismissBillingBanner={dismissBillingBanner}
        chatErrorBannerVisible={chatErrorBannerVisible}
        chatError={chatError}
        dismissChatErrorBanner={dismissChatErrorBanner}
        handleRetry={handleRetry}
      />

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto md:p-6 p-2 relative pt-8 md:pt-6"
      >
        {/* Token/Time Usage Badge */}
        <ChatTokenUsageBadge
          textTokens={sessionStats.textTokens}
          voiceSeconds={sessionStats.voiceSeconds}
        />
        <div className="max-w-4xl flex-1 mx-auto flex flex-col justify-end min-h-full w-full">
          {/* ── HERO WELCOME SCREEN (Only visible on new, empty chat) ── */}
          {messages.length === 0 && !chatId && !isLoading && (
            <ChatHero
              user={user}
              onSuggestionClick={(prompt: string, isFileUpload?: boolean) => {
                if (isFileUpload) {
                  chatInputRef.current?.triggerFileUpload(prompt);
                } else {
                  handleSend(prompt);
                }
              }}
            />
          )}

          {/* ── LOAD OLDER MESSAGES INDICATOR ── */}
          {isLoadingMore && (
            <div className="flex justify-center py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading older messages…
              </div>
            </div>
          )}
          {!isLoadingMore && hasMore && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadOlderMessages}
                className="text-xs text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
              >
                Load older messages
              </button>
            </div>
          )}

          {/* ── STANDARD CHAT MESSAGE LOOP ── */}
          <div className="space-y-6 w-full">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              return (
                <ChatMessage
                  key={msg.id}
                  msg={msg}
                  isLast={isLast}
                  isLoading={isLast ? isLoading : false}
                  chatError={chatError}
                  connectionStatus={connectionStatus}
                  onRetry={handleRetry}
                />
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
                  <div className="w-[220px] rounded-bl-xl rounded-tr-2xl rounded-br-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
                    <div className="w-full flex items-center gap-2.5 px-4 py-3 text-left bg-transparent">
                      <Sparkles
                        size={14}
                        className="shrink-0 text-slate-500 dark:text-slate-400 animate-pulse"
                      />
                      <span className="flex-1 text-[12px] font-medium text-slate-600 dark:text-slate-300 tracking-wide">
                        Thinking
                      </span>
                      <span className="flex gap-1 items-center mr-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-pulse"
                            style={{
                              animationDelay: `${i * 0.2}s`,
                              animationDuration: "1s",
                            }}
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
      <div className="shrink-0 relative z-10 w-full">
        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          connectionStatus={connectionStatus}
          isLoading={isLoading}
          onHeightChange={() => scrollToBottom(true)}
        />
      </div>
    </div>
  );
};

export default ChatInterface;
