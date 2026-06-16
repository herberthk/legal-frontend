/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { addTicketMessage, getTicketMessages } from "@/lib/actions/support";
import { uploadFileToStorage } from "@/lib/firebaseStorage";
import { formatDate } from "@/lib";

interface AdminTicketChatProps {
  ticket: Complaint;
  currentUser: User;
}

const AdminTicketChat: React.FC<AdminTicketChatProps> = ({
  ticket,
  currentUser,
}) => {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isClosed =
    ticket.status === "RESOLVED" || ticket.status === "REJECTED";

  useEffect(() => {
    setMessages([]);
    setIsLoading(true);
    startTransition(async () => {
      const msgs = await getTicketMessages(ticket.id);
      setMessages(msgs);
      setIsLoading(false);
    });
  }, [ticket.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    setIsSubmitting(true);

    const uploadedUrls: string[] = [];
    if (attachments.length > 0) {
      for (const file of attachments) {
        try {
          const url = await uploadFileToStorage(
            file,
            `tickets/${ticket.id}`,
            setUploadProgress
          );
          uploadedUrls.push(url);
        } catch (err) {
          console.error("Upload failed", err);
        }
      }
    }

    const result = await addTicketMessage(
      ticket.id,
      currentUser.id,
      "ADMIN",
      newMessage,
      uploadedUrls
    );

    if (result.success && result.messageId) {
      const newMsg: TicketMessage = {
        id: result.messageId,
        ticketId: ticket.id,
        senderId: currentUser.id,
        senderRole: "ADMIN",
        text: newMessage,
        attachments: uploadedUrls,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      setNewMessage("");
      setAttachments([]);
      setUploadProgress(0);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth">
        {/* Original Complaint */}
        <div className="flex gap-3 max-w-[80%]">
          <div className="shrink-0 w-7 h-7 rounded-full bg-linear-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold">
            {ticket.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">
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
          <div className="flex justify-center items-center py-8">
            <Loader2 className="animate-spin text-indigo-500" size={22} />
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.senderRole === "ADMIN";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAdmin ? "flex-row-reverse ml-auto max-w-[80%]" : "max-w-[80%]"}`}
              >
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md text-white text-xs font-bold ${
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

                <div className={isAdmin ? "items-end flex flex-col" : ""}>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      isAdmin
                        ? "bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-500/20"
                        : "bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                    }`}
                  >
                    {!isAdmin && (
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        {ticket.userName}
                      </p>
                    )}
                    {msg.text && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
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

        {isClosed && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
            <Lock size={12} />
            <span>
              Ticket is {ticket.status === "RESOLVED" ? "resolved" : "closed"}.
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
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
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                rows={1}
                value={newMessage}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Type a response… (Enter to send)"
                className="w-full resize-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all placeholder:text-slate-400 dark:text-slate-100"
                style={{ height: "44px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (!newMessage.trim() && attachments.length === 0)
              }
              className="shrink-0 w-10 h-10 flex items-center justify-center bg-linear-to-br from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-500/30 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Replying as{" "}
            <span className="font-semibold text-indigo-500">
              {currentUser.name}
            </span>{" "}
            (Support Team) · This reply will email the user
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminTicketChat;
