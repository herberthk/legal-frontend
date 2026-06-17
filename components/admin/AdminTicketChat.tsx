/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db as clientDb } from "@/firebase/client";
import { addTicketMessage, updateTicketStatus } from "@/lib/actions/support";
import { uploadFileToStorage } from "@/lib/firebaseStorage";
import { formatDate } from "@/lib";
import { useAuthStore } from "@/store";

interface AdminTicketChatProps {
  ticket: Complaint;
  currentUser: User;
  onStatusChange?: (newStatus: ComplaintStatus) => void;
}

const AdminTicketChat: React.FC<AdminTicketChatProps> = ({
  ticket,
  currentUser,
  onStatusChange,
}) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const userRole = useAuthStore((state) => state.user?.role) as Role

  // Resolve/Reject panel
  const [showResolvePanel, setShowResolvePanel] = useState(false);
  const [resolveAction, setResolveAction] = useState<"RESOLVED" | "REJECTED">(
    "RESOLVED"
  );
  const [resolutionMessage, setResolutionMessage] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resolutionRef = useRef<HTMLTextAreaElement>(null);

  const isClosed =
    ticket.status === "RESOLVED" || ticket.status === "REJECTED";

  // ── Real-time listener ────────────────────────────────────────────────
  useEffect(() => {
    setMessages([]);
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
        createdAt:
          doc.data().createdAt?.toDate().toISOString() ??
          new Date().toISOString(),
      }));
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => unsub();
  }, [ticket.id]);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Input handlers ────────────────────────────────────────────────────
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  // ── Send reply ────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
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
      userRole,
      newMessage,
      uploadedUrls
    );

    // onSnapshot delivers the new message automatically
    setNewMessage("");
    setAttachments([]);
    setUploadProgress(0);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSubmitting(false);
  };

  // ── Resolve / Reject ──────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!resolutionMessage.trim()) {
      resolutionRef.current?.focus();
      return;
    }
    setIsResolving(true);

    // 1) Post the resolution message to the thread
    await addTicketMessage(
      ticket.id,
      currentUser.id,
     userRole,
      resolutionMessage,
      []
    );

    // 2) Update ticket status + resolution note
    await updateTicketStatus(ticket.id, resolveAction, resolutionMessage);

    setShowResolvePanel(false);
    setResolutionMessage("");
    onStatusChange?.(resolveAction);
    setIsResolving(false);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Original complaint */}
        <div className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shadow">
            {ticket.userName.charAt(0).toUpperCase()}
          </div>
          <div className="max-w-[75%]">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">
                {ticket.userName} · Original complaint
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

        {/* Thread */}
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="animate-spin text-indigo-500" size={22} />
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderRole === "ADMIN" || msg.senderRole === "SUPER_ADMIN";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow text-white text-xs font-bold ${
                    isAdmin
                      ? "bg-linear-to-br from-indigo-500 to-indigo-600"
                      : "bg-linear-to-br from-slate-400 to-slate-600"
                  }`}
                >
                  {isAdmin ? (
                    <ShieldCheck size={14} />
                  ) : (
                    ticket.userName.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`flex flex-col max-w-[75%] ${isAdmin ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? "bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-none shadow shadow-indigo-400/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {!isAdmin && (
                      <p className="text-[11px] font-semibold text-slate-500 mb-1">
                        {ticket.userName}
                      </p>
                    )}
                    {msg.text && (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.attachments.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => setPreviewImage(url)}
                            className="relative group overflow-hidden rounded-xl border-2 border-white/20 w-28 h-28 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          >
                            <Image
                              src={url}
                              alt="attachment"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <ImageIcon size={18} className="text-white" />
                            </div>
                          </button>
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
              Ticket{" "}
              <strong>
                {ticket.status === "RESOLVED" ? "resolved" : "rejected"}
              </strong>{" "}
              — thread locked.
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Resolve / Reject Panel ── */}
      {showResolvePanel && (
        <div className="mx-4 mb-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              {/* Action toggle */}
              <button
                onClick={() => setResolveAction("RESOLVED")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  resolveAction === "RESOLVED"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                }`}
              >
                <CheckCircle2 size={13} /> Resolve
              </button>
              <button
                onClick={() => setResolveAction("REJECTED")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  resolveAction === "REJECTED"
                    ? "bg-red-600 text-white shadow"
                    : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                }`}
              >
                <XCircle size={13} /> Reject
              </button>
            </div>
            <button
              onClick={() => setShowResolvePanel(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Resolution message */}
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {resolveAction === "RESOLVED"
                ? "Write a closing note to the user explaining the resolution:"
                : "Write a note explaining why this ticket is being rejected:"}
            </p>
            <textarea
              ref={resolutionRef}
              rows={3}
              value={resolutionMessage}
              onChange={(e) => setResolutionMessage(e.target.value)}
              placeholder={
                resolveAction === "RESOLVED"
                  ? "e.g. Your issue has been resolved. The refund has been processed and should reflect within 3-5 business days."
                  : "e.g. After reviewing your complaint, we could not verify the reported issue. Please contact support if you need further assistance."
              }
              className="w-full resize-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 placeholder:text-slate-400 dark:text-slate-100 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowResolvePanel(false)}
                className="flex-1 py-2 text-sm text-slate-500 font-semibold hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving || !resolutionMessage.trim()}
                className={`flex-1 py-2 text-sm text-white font-bold rounded-xl shadow transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  resolveAction === "RESOLVED"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                }`}
              >
                {isResolving ? (
                  <Loader2 size={15} className="animate-spin mx-auto" />
                ) : resolveAction === "RESOLVED" ? (
                  "Mark as Resolved"
                ) : (
                  "Reject Ticket"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Input / Actions ── */}
      {!isClosed && !showResolvePanel && (
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
                className="bg-linear-to-r from-indigo-500 to-indigo-600 h-1 rounded-full transition-all"
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
              className="shrink-0 p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Type a response… (Enter to send)"
              className="flex-1 resize-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all placeholder:text-slate-400 dark:text-slate-100"
              style={{ height: "40px", maxHeight: "120px" }}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={
                isSubmitting ||
                (!newMessage.trim() && attachments.length === 0)
              }
              className="shrink-0 w-10 h-10 flex items-center justify-center bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow shadow-indigo-500/30 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>

          {/* Resolve / Reject trigger */}
          <div className="flex justify-between items-center mt-2.5">
            <p className="text-[10px] text-slate-400">
              Replying as{" "}
              <span className="font-semibold text-indigo-500">
                {currentUser.name}
              </span>{" "}
              (Support Team) · User will be emailed
            </p>
            <button
              onClick={() => setShowResolvePanel(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Close ticket <ChevronDown size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Closed state footer */}
      {isClosed && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Lock size={11} />
            This ticket is{" "}
            <strong
              className={
                ticket.status === "RESOLVED"
                  ? "text-emerald-600"
                  : "text-red-500"
              }
            >
              {ticket.status === "RESOLVED" ? "Resolved" : "Rejected"}
            </strong>{" "}
            — No further replies can be sent
          </p>
        </div>
      )}

      {/* ── Image Lightbox Modal ── */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8"
            onClick={() => setPreviewImage(null)}
          >
            <button
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md z-[101]"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-5xl h-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={previewImage}
                alt="Attachment Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTicketChat;
