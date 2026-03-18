"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store";
import {
  PlusCircle,
  MessageSquare,
  Loader2,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  updateChatSessionTitle,
  deleteChatSession,
  getChatSessions,
} from "@/lib/actions/chat";
import { toast } from "sonner";
import { formatDate } from "@/utils";

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
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (session: any) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title || "New Conversation");
    setActiveMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSessionId || !editTitle.trim()) return;

    try {
      const result = await updateChatSessionTitle(editingSessionId, editTitle);
      if (result.success) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId ? { ...s, title: editTitle } : s,
          ),
        );
        toast.success("Chat renamed successfully", {
          style: {
            background: "green",
          },
        });
      } else {
        toast.error("Failed to rename chat", {
          style: {
            background: "red",
          },
        });
      }
    } catch (error) {
      toast.error("An error occurred while renaming", {
        style: {
          background: "red",
        },
      });
    } finally {
      setEditingSessionId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    setIsDeleting(true);
    try {
      const result = await deleteChatSession(sessionId);
      if (result.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeChatId === sessionId) {
          onSelectChat(null);
        }
        toast.success("Chat deleted successfully", {
          style: {
            background: "green",
          },
        });
      } else {
        toast.error("Failed to delete chat", {
          style: {
            background: "red",
          },
        });
      }
    } catch (error) {
      toast.error("An error occurred while deleting", {
        style: {
          background: "red",
        },
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmId(null);
    }
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
            <div
              key={session.id}
              className="relative group"
              onMouseEnter={() => setHoveredSessionId(session.id)}
              onMouseLeave={() => {
                setHoveredSessionId(null);
                if (activeMenuId === session.id) setActiveMenuId(null);
              }}
            >
              {editingSessionId === session.id ? (
                <div className="flex items-center space-x-1 p-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800/30">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 bg-transparent border-none! focus:ring-0! focus:outline-none! text-sm text-slate-800 dark:text-slate-200 rounded-md"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingSessionId(null);
                    }}
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 rounded"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingSessionId(null)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  className={`w-full relative group flex items-center p-3 rounded-lg transition-all duration-200 ${
                    activeChatId === session.id
                      ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => onSelectChat(session.id)}
                    className="flex-1 flex flex-col space-y-1 text-left min-w-0"
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

                  <div className="flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(
                          activeMenuId === session.id ? null : session.id,
                        );
                      }}
                      className={`p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-opacity duration-200 ${
                        hoveredSessionId === session.id ||
                        activeMenuId === session.id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    >
                      <MoreVertical size={14} className="text-slate-500" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === session.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-10 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1"
                        >
                          <button
                            onClick={() => handleEdit(session)}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            <Edit2 size={12} />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirmId(session.id);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirmId && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full overflow-hidden"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  Delete Conversation?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  This will permanently delete this entire chat session and all
                  associated messages. This action cannot be undone.
                </p>

                <div className="flex space-x-3">
                  <button
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirmId(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isDeleting}
                    onClick={() => handleDelete(showDeleteConfirmId)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg shadow-red-600/20 transition-all flex items-center justify-center disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="animate-spin" size={16} />
                        <span>Deleting...</span>
                      </div>
                    ) : (
                      "Delete Session"
                    )}
                  </button>
                </div>
              </div>

              {isDeleting && (
                <div className="h-1 bg-red-100 dark:bg-red-900/30 overflow-hidden">
                  <motion.div
                    className="h-full bg-red-600"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatHistorySidebar;
