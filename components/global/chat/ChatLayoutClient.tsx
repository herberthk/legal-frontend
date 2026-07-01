"use client";

import { useState } from "react";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { useRouter } from "nextjs-toploader/app";
import { useParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu, Plus } from "lucide-react";

interface ChatLayoutClientProps {
  children: React.ReactNode;
  serverSessions?: ChatSession[];
}

const CHAT_BASE = "/dashboard/chat";

const ChatLayoutClient = ({
  children,
  serverSessions,
}: ChatLayoutClientProps) => {
  const router = useRouter();
  const params = useParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeChatId = (params?.chatId as string) || null;

  const handleSelectChat = (chatId: string | null) => {
    setIsMobileMenuOpen(false); // Close the mobile sidebar
    if (chatId === activeChatId) return; // Already on this chat

    if (chatId) {
      // Navigate to /dashboard/chat/[chatId]
      router.push(`${CHAT_BASE}/${chatId}`);
    } else {
      // Navigate to /dashboard/chat (start a new chat)
      router.push(CHAT_BASE);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Mobile Top Header */}

      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-1">
        <div className="flex items-center space-x-3">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                aria-label="Toggle chat history sidebar"
              >
                <Menu size={22} className="shrink-0" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-[280px] sm:w-[320px] border-r border-slate-200 dark:border-slate-800"
            >
              <SheetTitle className="sr-only">Chat History</SheetTitle>
              <ChatHistorySidebar
                activeChatId={activeChatId}
                onSelectChat={handleSelectChat}
                serverSessions={serverSessions}
              />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-lg text-slate-800 dark:text-slate-100 tracking-tight">
            Chat sessions
          </span>
        </div>

        <button
          onClick={() => handleSelectChat(null)}
          className="p-1.5 -mr-1 text-slate-500 hover:text-orange-600 dark:text-slate-400 dark:hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors focus:outline-none flex items-center justify-center shrink-0"
          title="New Chat"
          aria-label="New chat"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        <ChatHistorySidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          serverSessions={serverSessions}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col relative z-0">
        {children}
      </div>
    </div>
  );
};

export default ChatLayoutClient;
