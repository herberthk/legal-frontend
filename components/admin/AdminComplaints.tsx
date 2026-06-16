"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Ticket,
  Tag,
  Calendar,
  Users,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { formatDate } from "@/lib";
import AdminTicketChat from "./AdminTicketChat";
import { updateTicketStatus } from "@/lib/actions/support";

interface AdminComplaintsProps {
  initialTickets: Complaint[];
  currentUser: User;
}

const STATUS_OPTIONS: { value: ComplaintStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Tickets" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_CONFIG = {
  OPEN: {
    icon: <AlertCircle size={12} />,
    label: "Open",
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  IN_PROGRESS: {
    icon: <Clock size={12} />,
    label: "In Progress",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  RESOLVED: {
    icon: <CheckCircle2 size={12} />,
    label: "Resolved",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    icon: <XCircle size={12} />,
    label: "Rejected",
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    dot: "bg-red-500",
  },
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-red-500",
};

const AdminComplaints: React.FC<AdminComplaintsProps> = ({
  initialTickets,
  currentUser,
}) => {
  const [tickets, setTickets] = useState<Complaint[]>(initialTickets);
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [filter, setFilter] = useState<ComplaintStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const filteredTickets = tickets.filter((t) => {
    if (filter !== "ALL" && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.subject.toLowerCase().includes(q) &&
        !t.email.toLowerCase().includes(q) &&
        !t.userName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const stats = {
    open: tickets.filter((t) => t.status === "OPEN").length,
    inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    resolved: tickets.filter((t) => t.status === "RESOLVED").length,
    total: tickets.length,
  };

  const handleStatusChange = async (newStatus: ComplaintStatus) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    const result = await updateTicketStatus(selectedTicket.id, newStatus);
    if (result.success) {
      const updated = { ...selectedTicket, status: newStatus };
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? updated : t))
      );
      setSelectedTicket(updated);
    }
    setUpdatingStatus(false);
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <MessageSquare size={15} className="text-white" />
              </div>
              Complaints Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 ml-10">
              Manage and resolve user support tickets
            </p>
          </div>

          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.total}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Total
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-blue-600">{stats.open}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Open
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-amber-600">
                {stats.inProgress}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Active
              </p>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">
                {stats.resolved}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Resolved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body: Split Pane ── */}
      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Left Pane */}
        <div
          className={`flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 transition-all ${
            selectedTicket
              ? "hidden md:flex md:w-80 lg:w-96 shrink-0"
              : "w-full"
          }`}
        >
          {/* Search & Filter */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search by subject, email, or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {STATUS_OPTIONS.map((opt) => {
                const count =
                  opt.value === "ALL"
                    ? tickets.length
                    : tickets.filter((t) => t.status === opt.value).length;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filter === opt.value
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {opt.label}
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                        filter === opt.value
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
                <Ticket size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No tickets found</p>
                <p className="text-xs mt-1">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredTickets.map((ticket) => {
                  const statusCfg = STATUS_CONFIG[ticket.status];
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full text-left px-4 py-3.5 transition-all group ${
                        isSelected
                          ? "bg-indigo-50 dark:bg-indigo-950/30 border-r-2 border-r-indigo-500"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`}
                        />
                        <span
                          className={`font-bold text-sm truncate flex-1 ${
                            isSelected
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {ticket.subject}
                        </span>
                        <span
                          className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[ticket.priority] ?? "bg-slate-400"}`}
                          title={`${ticket.priority} priority`}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
                          <UserIcon size={10} />
                          <span className="truncate">{ticket.email}</span>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusCfg.cls}`}
                        >
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Detail Header */}
              <div className="shrink-0 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Mobile back */}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="md:hidden flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  ← Back to list
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-black text-slate-900 dark:text-white">
                      #{selectedTicket.id.slice(-6).toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CONFIG[selectedTicket.status].cls}`}
                    >
                      {STATUS_CONFIG[selectedTicket.status].icon}
                      {STATUS_CONFIG[selectedTicket.status].label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        selectedTicket.priority === "HIGH"
                          ? "bg-red-50 text-red-600 dark:bg-red-950/30"
                          : selectedTicket.priority === "MEDIUM"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {selectedTicket.priority} priority
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <UserIcon size={10} /> {selectedTicket.userName} ·{" "}
                      {selectedTicket.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag size={10} />{" "}
                      {selectedTicket.category.replace("_", " ")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />{" "}
                      {formatDate(selectedTicket.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Status change dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                    Set status:
                  </span>
                  <div className="relative">
                    <select
                      value={selectedTicket.status}
                      disabled={updatingStatus}
                      onChange={(e) =>
                        handleStatusChange(e.target.value as ComplaintStatus)
                      }
                      className="appearance-none pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer disabled:opacity-50 dark:text-slate-100"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="flex-1 overflow-hidden p-4 md:p-6">
                <AdminTicketChat
                  ticket={selectedTicket}
                  currentUser={currentUser}
                />
              </div>
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <MessageSquare size={36} className="opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-500">
                  Select a ticket to view the conversation
                </p>
                <p className="text-sm mt-1">
                  Choose from the list on the left to start responding
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminComplaints;
