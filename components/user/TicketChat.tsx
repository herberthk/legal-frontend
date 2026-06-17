"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Lock,
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db as clientDb } from "@/firebase/client";
import { addTicketMessage } from "@/lib/actions/support";
import { uploadFileToStorage } from "@/lib/firebaseStorage";
import { formatDate } from "@/lib";

interface TicketChatProps {
  ticket: Complaint;
  currentUser: User;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  OPEN: {
    label: "Open",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    icon: <AlertCircle size={12} />,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    icon: <Clock size={12} />,
  },
  RESOLVED: {
    label: "Resolved",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    icon: <CheckCircle2 size={12} />,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    icon: <XCircle size={12} />,
  },
};

const TicketChat: React.FC<TicketChatProps> = ({
  ticket,
  currentUser,
  onClose,
}) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const statusConfig = STATUS_CONFIG[ticket.status];
  const isClosed =
    ticket.status === "RESOLVED" || ticket.status === "REJECTED";

  // ── Real-time listener ──────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    const q = query(
      collection(clientDb, "supportMessages"),
      where("ticketId", "==", ticket.id),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs: TicketMessage[] = snap.docs.map((doc) => ({
        ...(doc.data() as Omit<TicketMessage, "id" | "createdAt">),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate().toISOString() ?? new Date().toISOString(),
      }));
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => unsub();
  }, [ticket.id]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    setIsSubmitting(true);
    const uploadedUrls: string[] = [];

    for (const file of attachments) {
      try {
        const url = await uploadFileToStorage(
          file,
          `tickets/${ticket.id}`,
          setUploadProgress
        );
        uploadedUrls.push(url);
      } catch (e) {
        console.error("Upload failed", e);
      }
    }

    await addTicketMessage(
      ticket.id,
      currentUser.id,
      "USER",
      newMessage,
      uploadedUrls
    );

    // onSnapshot will deliver the new message automatically
    setNewMessage("");
    setAttachments([]);
    setUploadProgress(0);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSubmitting(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[580px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                Ticket #{ticket.id.slice(-6).toUpperCase()}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.color}`}
              >
                {statusConfig.icon} {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{ticket.subject}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Original complaint — always left (system message style) */}
        <div className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="max-w-[75%]">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3">
              <p className="text-[11px] font-semibold text-orange-500 mb-1">
                {currentUser.name} · Original complaint
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {ticket.description}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 ml-1">
              {formatDate(ticket.createdAt)}
            </p>
          </div>
        </div>

        {/* Legacy resolution note */}
        {ticket.resolutionNote && messages.length === 0 && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <div className="max-w-[75%]">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-2xl rounded-tl-none px-4 py-3">
                <p className="text-[11px] font-semibold text-indigo-500 mb-1">
                  Support Team
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {ticket.resolutionNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Thread */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="animate-spin text-orange-500" size={22} />
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.senderRole === "USER";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow text-white text-xs font-bold ${
                    isUser
                      ? "bg-linear-to-br from-orange-400 to-orange-600"
                      : "bg-linear-to-br from-indigo-400 to-indigo-600"
                  }`}
                >
                  {isUser ? (
                    currentUser.name.charAt(0).toUpperCase()
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-linear-to-br from-orange-500 to-orange-600 text-white rounded-tr-none shadow shadow-orange-400/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {!isUser && (
                      <p className="text-[11px] font-semibold text-indigo-500 mb-1">
                        Support Team
                      </p>
                    )}
                    {msg.text && (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.attachments.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative group overflow-hidden rounded-xl border-2 border-white/20"
                          >
                            <img
                              src={url}
                              alt="attachment"
                              className="w-28 h-28 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ImageIcon size={18} className="text-white" />
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 mx-1">
                    {formatDate(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Closed notice */}
        {isClosed && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-3 border-t border-dashed border-slate-200 dark:border-slate-700 mt-2">
            <Lock size={12} />
            <span>
              This ticket is{" "}
              <strong>
                {ticket.status === "RESOLVED" ? "resolved" : "closed"}
              </strong>
              . No further replies can be sent.
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full text-xs text-slate-600 dark:text-slate-300"
                >
                  <Paperclip size={11} />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="ml-1 hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 mb-2">
              <div
                className="bg-linear-to-r from-orange-500 to-orange-600 h-1 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-xl transition-colors"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Write a reply… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 transition-all placeholder:text-slate-400 dark:text-slate-100"
              style={{ height: "40px", maxHeight: "120px" }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting || (!newMessage.trim() && attachments.length === 0)
              }
              className="shrink-0 w-10 h-10 flex items-center justify-center bg-linear-to-br from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow shadow-orange-500/30 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Replies are typically answered within 24 hours
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketChat;
