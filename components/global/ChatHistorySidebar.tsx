"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store";
import { getChatSessions } from "@/lib/actions/chat";
import { PlusCircle, MessageSquare, Loader2 } from "lucide-react";

interface ChatHistorySidebarProps {
  activeChatId: string | null;
  onSelectChat: (chatId: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverSessions?: any[] | null;
}

const ChatHistorySidebar = ({
  activeChatId,
  onSelectChat,
  serverSessions,
}: ChatHistorySidebarProps) => {
  const user = useAuthStore((state) => state.user);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessions, setSessions] = useState<any[]>(serverSessions || []);
  const [isLoading, setIsLoading] = useState(!serverSessions);

  // Poll for sessions to keep it updated when a new message creates a session
  useEffect(() => {
    let mounted = true;

    const fetchSessions = async () => {
      if (!user?.id) return;
      try {
        const result = await getChatSessions(user.id);
        if (mounted && result.success) {
          setSessions(result.sessions || []);
        }
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchSessions();

    // Set up a simple polling interval to catch new sessions created by the ChatInterface
    // In a production app, Firestore real-time listeners would be preferable here.
    const interval = setInterval(fetchSessions, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden transition-colors duration-200">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onSelectChat(null)}
          className="w-full flex items-center justify-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm font-medium text-sm"
        >
          <PlusCircle size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-2">
          Recent Chats
        </h3>

        {isLoading && sessions.length === 0 ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-slate-400" size={20} />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4 px-2">
            No previous chats. Start a conversation!
          </p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectChat(session.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors flex flex-col space-y-1 ${
                activeChatId === session.id
                  ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent"
              }`}
            >
              <div className="flex items-center space-x-2">
                <MessageSquare
                  size={14}
                  className={
                    activeChatId === session.id
                      ? "text-orange-500"
                      : "text-slate-400"
                  }
                />
                <span
                  className={`text-sm truncate font-medium ${
                    activeChatId === session.id
                      ? "text-orange-700 dark:text-orange-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {session.title || "New Conversation"}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 pl-5">
                {formatDate(session.updatedAt)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistorySidebar;
