"use client";

import React, { useState, useTransition } from "react";
import {
  LifeBuoy,
  PlusCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MessageSquare,
  Ticket,
  ChevronLeft,
  ChevronDown,
  Tag,
  Calendar,
  CornerDownRight,
  X,
} from "lucide-react";
import { HelpFAQ } from "./HelpFAQ";
import TicketChat from "./TicketChat";
import { createSupportTicket } from "@/lib/actions/support";
import { formatDate } from "@/lib";
import BackButton from "../global/BackButton";

interface SupportPageProps {
  user: User;
  initialTickets: Complaint[];
  faqs: HelpArticle[];
}

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  REFUND: "Refund Request",
  OVERCHARGE: "Overcharge",
  DOUBLE_CHARGE: "Double Charge",
  TECHNICAL: "Technical Issue",
  OTHER: "General Inquiry",
};

const STATUS_CONFIG = {
  OPEN: {
    icon: <AlertCircle size={13} />,
    label: "Open",
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  },
  IN_PROGRESS: {
    icon: <Clock size={13} />,
    label: "In Progress",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  },
  RESOLVED: {
    icon: <CheckCircle2 size={13} />,
    label: "Resolved",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  REJECTED: {
    icon: <XCircle size={13} />,
    label: "Rejected",
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
  },
};

const PRIORITY_CONFIG = {
  LOW: { cls: "text-slate-400 bg-slate-100 dark:bg-slate-800", label: "Low" },
  MEDIUM: { cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", label: "Medium" },
  HIGH: { cls: "text-red-600 bg-red-50 dark:bg-red-950/30", label: "High" },
};

const SupportPage: React.FC<SupportPageProps> = ({
  user,
  initialTickets,
  faqs,
}) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Complaint[]>(initialTickets);
  const [formData, setFormData] = useState({
    subject: "",
    category: "TECHNICAL" as ComplaintCategory,
    description: "",
    transactionId: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const itemsPerPage = 5;

  const totalPages = Math.ceil(tickets.length / itemsPerPage);
  const currentTickets = tickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await createSupportTicket({
      userId: user.id,
      userName: user.name,
      email: user.email,
      ...formData,
      transactionId: formData.transactionId || undefined,
    });

    if (result.success) {
      const newTicket: Complaint = {
        id: result.ticketId!,
        userId: user.id,
        userName: user.name,
        email: user.email,
        ...formData,
        status: "OPEN",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTickets((prev) => [newTicket, ...prev]);
      setShowNewTicket(false);
      setFormData({
        subject: "",
        category: "TECHNICAL",
        description: "",
        transactionId: "",
        priority: "MEDIUM",
      });
      setCurrentPage(1);
    } else {
      alert("Failed to create ticket. Please try again.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Help &amp; Support
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Browse FAQs or open a support ticket for specialist help.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTicket(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/25 transition-all hover:scale-105 active:scale-95 font-bold text-sm"
          >
            <PlusCircle size={16} />
            New Support Ticket
          </button>
        </div>

        {/* ── Stats Strip ── */}
        {tickets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as ComplaintStatus[]).map(
              (status) => {
                const count = tickets.filter((t) => t.status === status).length;
                const cfg = STATUS_CONFIG[status];
                return (
                  <div
                    key={status}
                    className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-100 dark:border-slate-800 shadow-sm"
                  >
                    <span className={`p-2 rounded-lg border ${cfg.cls}`}>
                      {cfg.icon}
                    </span>
                    <div>
                      <p className="text-xl font-black text-slate-900 dark:text-white">
                        {count}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {cfg.label}
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* ── Main Grid ── */}
        {/* className="grid grid-cols-1 lg:grid-cols-3 gap-6" */}
        <div className="w-full">

          {/* Left: Tickets / Chat */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Ticket size={17} className="text-orange-500" />
              {selectedTicket ? "Ticket Conversation" : "Your Support Tickets"}
            </h2>

            {selectedTicket ? (
              <TicketChat
                ticket={selectedTicket}
                currentUser={user}
                onClose={() => setSelectedTicket(null)}
              />
            ) : tickets.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 flex items-center justify-center mb-4 border border-orange-100 dark:border-orange-900">
                  <LifeBuoy size={28} className="text-orange-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                  No tickets yet
                </h3>
                <p className="text-sm text-slate-400 max-w-xs mb-5">
                  Have a question or issue? Our support team is here to help.
                </p>
                <button
                  onClick={() => setShowNewTicket(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-colors"
                >
                  <PlusCircle size={15} /> Open First Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentTickets.map((ticket) => {
                  const statusCfg = STATUS_CONFIG[ticket.status];
                  const priorityCfg = PRIORITY_CONFIG[ticket.priority];
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className="w-full text-left bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                            {ticket.subject}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {ticket.description}
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-slate-300 group-hover:text-orange-500 transition-colors mt-0.5"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCfg.cls}`}
                        >
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                        {/* Priority */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${priorityCfg.cls}`}
                        >
                          {priorityCfg.label} priority
                        </span>
                        {/* Category */}
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider">
                          <Tag size={9} />
                          {CATEGORY_LABELS[ticket.category]}
                        </span>
                        {/* Date */}
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 ml-auto">
                          <Calendar size={9} />
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>

                      {/* Resolution note preview */}
                      {ticket.resolutionNote && (
                        <div className="mt-3 flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl px-3 py-2 border border-indigo-100 dark:border-indigo-900">
                          <CornerDownRight
                            size={12}
                            className="text-indigo-400 mt-0.5 shrink-0"
                          />
                          <p className="text-xs text-indigo-700 dark:text-indigo-300 line-clamp-1">
                            {ticket.resolutionNote}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: FAQ */}
          {/* <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare size={17} className="text-orange-500" />
              Frequently Asked
            </h2>
            <HelpFAQ articles={faqs} />
          </div> */}
        </div>
      </div>

      {/* ── New Ticket Modal ── */}
      {showNewTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setShowNewTicket(false)
          }
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/20 max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
                  <LifeBuoy size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Open a Ticket
                  </h3>
                  <p className="text-xs text-slate-400">
                    Our team typically responds within 24 hours
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewTicket(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Category & Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      required
                      className="w-full appearance-none px-4 py-2.5 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all dark:text-slate-100"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as ComplaintCategory,
                        })
                      }
                    >
                      <option value="TECHNICAL">Technical Issue</option>
                      <option value="REFUND">Refund Request</option>
                      <option value="OVERCHARGE">Overcharge</option>
                      <option value="DOUBLE_CHARGE">Double Charge</option>
                      <option value="OTHER">General Inquiry</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none px-4 py-2.5 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all dark:text-slate-100"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as "LOW" | "MEDIUM" | "HIGH",
                        })
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Subject
                </label>
                <input
                  required
                  type="text"
                  placeholder="Brief summary of your issue"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all dark:text-slate-100 placeholder:text-slate-400"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your issue in detail…"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all resize-none dark:text-slate-100 placeholder:text-slate-400"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              {/* Transaction ID (optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Transaction ID{" "}
                  <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-20240101-XXXX"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 outline-none transition-all dark:text-slate-100 placeholder:text-slate-400"
                  value={formData.transactionId}
                  onChange={(e) =>
                    setFormData({ ...formData, transactionId: e.target.value })
                  }
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicket(false)}
                  className="flex-1 py-2.5 text-slate-500 dark:text-slate-400 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-500/25 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
