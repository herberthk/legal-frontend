"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { HelpFAQ } from "./HelpFAQ";
import { createSupportTicket } from "@/lib/actions/support";

interface SupportPageProps {
  user: User;
  initialTickets: Complaint[];
  faqs: HelpArticle[];
}

const SupportPage: React.FC<SupportPageProps> = ({
  user,
  initialTickets,
  faqs,
}) => {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Complaint[]>(initialTickets);
  const [formData, setFormData] = useState({
    subject: "",
    category: "TECHNICAL" as ComplaintCategory,
    description: "",
    transactionId: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(tickets.length / itemsPerPage);
  const currentTickets = tickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
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
      // Optimistic update (or we could just rely on revalidatePath, but for UI snappiness we update local state)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "IN_PROGRESS":
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      case "RESOLVED":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
        return <AlertCircle size={14} />;
      case "IN_PROGRESS":
        return <Clock size={14} />;
      case "RESOLVED":
        return <CheckCircle2 size={14} />;
      case "REJECTED":
        return <XCircle size={14} />;
      default:
        return <Ticket size={14} />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Help & Support
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Browse FAQs or submit a ticket for specialized assistance.
          </p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 font-bold"
        >
          <PlusCircle size={18} />
          <span>New Support Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Tickets */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ticket size={20} className="text-orange-500" />
            Your Support Tickets
          </h2>

          {tickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                <LifeBuoy size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                No active tickets
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                Need help? Submit a ticket and our team will get back to you
                shortly.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-xl ${getStatusColor(ticket.status).replace("border", "")} bg-opacity-20`}
                      >
                        {getStatusIcon(ticket.status)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {ticket.subject}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="font-mono">
                            #{ticket.id.slice(-6).toUpperCase()}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 uppercase tracking-wider ${getStatusColor(ticket.status)}`}
                    >
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace("_", " ")}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4 pl-14">
                    {ticket.description}
                  </p>
                  {ticket.resolutionNote && (
                    <div className="ml-14 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-sm">
                      <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                        <MessageSquare size={14} className="text-indigo-500" />
                        Support Response
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {ticket.resolutionNote}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <span className="text-xs text-slate-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: FAQ */}
        <div className="space-y-6">
          <HelpFAQ articles={faqs} />
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Submit Ticket
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                  Category
                </label>
                <select
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
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
                  <option value="DOUBLE_CHARGE">Billing Dispute</option>
                  <option value="OTHER">General Inquiry</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                  Subject
                </label>
                <input
                  required
                  type="text"
                  placeholder="What can we help you with?"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide some details..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewTicket(false)}
                  className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmitting ? "Submitting..." : "Send Ticket"}
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
