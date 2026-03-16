"use client";

import React, { useState, useEffect } from "react";
import ChatInterface from "./ChatInterface";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { useRouter } from "nextjs-toploader/app";

interface ChatContainerProps {
  serverChatId?: string | null;
  serverMessages?: ChatMessageRecord[] | null;
  serverSessions?: ChatSession[] | null;
}

const CHAT_BASE = "/dashboard/user/chat";

const ChatContainer = ({
  serverChatId,
  serverMessages,
  serverSessions,
}: ChatContainerProps) => {
  const router = useRouter();

  // serverChatId is the SSR-injected value from the [chatId] route segment.
  // It is the single source of truth — no need to read query params.
  const [activeChatId, setActiveChatId] = useState<string | null>(
    serverChatId || null,
  );

  // Keep local state in sync when Next.js re-renders the page with a new segment
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveChatId(serverChatId || null);
  }, [serverChatId]);

  const handleSelectChat = (chatId: string | null) => {
    setActiveChatId(chatId);
    if (chatId) {
      // Navigate to /dashboard/user/chat/[chatId]
      router.push(`${CHAT_BASE}/${chatId}`);
    } else {
      // Navigate to /dashboard/user/chat (start a new chat)
      router.push(CHAT_BASE);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:block h-full">
        <ChatHistorySidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          serverSessions={serverSessions}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        <ChatInterface
          chatId={activeChatId}
          onChatCreated={(newId) => {
            if (newId !== activeChatId) {
              handleSelectChat(newId);
            }
          }}
          serverChatId={serverChatId}
          serverMessages={serverMessages}
        />
      </div>
    </div>
  );
};

export default ChatContainer;
