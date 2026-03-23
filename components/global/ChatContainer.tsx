"use client";

import React from "react";
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

  const handleSelectChat = (chatId: string | null) => {
    if (chatId === serverChatId) return; // Already on this chat

    if (chatId) {
      // Navigate to /dashboard/user/chat/[chatId]
      router.push(`${CHAT_BASE}/${chatId}`);
    } else {
      // Navigate to /dashboard/user/chat (start a new chat)
      router.push(CHAT_BASE);
    }
  };

  const activeChatId = serverChatId || null;

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
