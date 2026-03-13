"use client";

import React, { useState, useEffect } from "react";
import ChatInterface from "./ChatInterface";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface ChatContainerProps {
  serverChatId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverMessages?: any[] | null;
  serverSessions?: ChatSession[] | null;
}

const ChatContainer = ({ serverChatId, serverMessages, serverSessions }: ChatContainerProps) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [activeChatId, setActiveChatId] = useState<string | null>(
    searchParams.get("chatId") || serverChatId || null,
  );

  // Sync state with URL
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveChatId(chatId);
  }, [searchParams]);

  const handleSelectChat = (chatId: string | null) => {
    setActiveChatId(chatId);

    // Update URL to reflect the current chat, allowing easy sharing/refreshing
    if (chatId) {
      router.push(`${pathname}?chatId=${chatId}`);
    } else {
      router.push(pathname); // Clears the chatId param
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Sidebar - hidden on very small screens, could add a drawer toggle later */}
      <div className="hidden md:block h-full">
        <ChatHistorySidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          serverSessions={serverSessions}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        {/* Mobile Header Toggle (Optional future enhancement for mobile sidebar) */}
        {/* 
        <div className="md:hidden p-2 border-b bg-white dark:bg-slate-900">
           Mobile layout switch
        </div> 
        */}
        <ChatInterface
          chatId={activeChatId}
          onChatCreated={(newId) => {
            // If a new chat is created via the interface, update state and URL
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
