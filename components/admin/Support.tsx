"use client";
import React, { useState, useEffect } from "react";
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
import { complaints as userComplaints } from "@/constants";
import { formatDate } from "@/utils";

interface SupportPageProps {
  user: User;
}

export const SupportPage: React.FC<SupportPageProps> = ({ user }) => {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    category: "TECHNICAL" as ComplaintCategory,
    description: "",
    transactionId: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
  });

  const [complaints, setComplaints] = useState<Complaint[]>(userComplaints);

  const handleCreateComplaint = (
    newComplaintData: Omit<
      Complaint,
      "id" | "createdAt" | "updatedAt" | "status"
    >,
  ) => {
    const newComplaint: Complaint = {
      id: `cmp_${Date.now()}`,
      ...newComplaintData,
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setComplaints((prev) => [newComplaint, ...prev]);
  };
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const myComplaints = complaints
    .filter((c) => c.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  // Slice Data
  const totalPages = Math.ceil(myComplaints.length / itemsPerPage);
  const currentComplaints = myComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateComplaint({
      userId: user.id,
      userName: user.name,
      email: user.email,
      ...formData,
      transactionId: formData.transactionId || undefined,
    });
    setShowNewTicket(false);
    setFormData({
      subject: "",
      category: "TECHNICAL",
      description: "",
      transactionId: "",
      priority: "MEDIUM",
    });
    setCurrentPage(1); // Return to first page to see new ticket
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Help & Support
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Submit tickets for refunds, technical issues, or billing disputes.
          </p>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <PlusCircle size={18} />
          <span>Create New Ticket</span>
        </button>
      </div>

      {myComplaints.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-900 mb-6">
            <LifeBuoy size={40} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No tickets found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
            You haven&apos;t filed any support tickets yet. If you have an issue
            with a transaction or technical problem, let us know.
          </p>
          <button
            onClick={() => setShowNewTicket(true)}
            className="text-orange-600 dark:text-orange-500 font-medium hover:underline"
          >
            Submit your first ticket
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            {currentComplaints.map((complaint) => (
              <div
                key={complaint.id}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-xl ${getStatusColor(complaint.status).replace("border", "")} bg-opacity-20`}
                    >
                      {getStatusIcon(complaint.status)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                        {complaint.subject}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="font-mono">
                          #{complaint.id.slice(-6).toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>
                          {mounted ? formatDate(complaint.createdAt) : "Loading..."}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-medium tracking-wide">
                          {complaint.category.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`self-start md:self-center px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 uppercase tracking-wider ${getStatusColor(complaint.status)}`}
                  >
                    {getStatusIcon(complaint.status)}
                    {complaint.status.replace("_", " ")}
                  </div>
                </div>

                <div className="pl-18">
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                    {complaint.description}
                  </p>

                  {complaint.resolutionNote && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 text-sm">
                      <div className="flex items-center gap-2 mb-2 font-bold text-slate-900 dark:text-white">
                        <MessageSquare size={14} className="text-indigo-500" />
                        Support Response
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        {complaint.resolutionNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {myComplaints.length > 0 && (
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-500">
                Showing{" "}
                {Math.min(
                  (currentPage - 1) * itemsPerPage + 1,
                  myComplaints.length,
                )}{" "}
                to {Math.min(currentPage * itemsPerPage, myComplaints.length)}{" "}
                of {myComplaints.length} tickets
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <ChevronLeft
                    size={16}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <ChevronRight
                    size={16}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in p-4">
          <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Submit Support Ticket
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Issue Category
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as ComplaintCategory,
                    })
                  }
                >
                  <option value="REFUND">Refund Request</option>
                  <option value="DOUBLE_CHARGE">
                    Double Charge / Overcharge
                  </option>
                  <option value="TECHNICAL">Technical Issue</option>
                  <option value="OTHER">Other Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                  placeholder="Brief summary of the issue"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                    placeholder="e.g. TX-1234"
                    value={formData.transactionId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        transactionId: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        priority: e.target.value as any,
                      })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High (Urgent)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white resize-none"
                  placeholder="Please describe the issue in detail..."
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
                  className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
