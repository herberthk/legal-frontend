"use client";

import React from "react";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

function ComplaintStatusBadge({ status }: { status: string }) {
  if (status === "OPEN") return <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/30 px-2 py-0.5 rounded">Open</span>;
  if (status === "IN_PROGRESS") return <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">In Progress</span>;
  if (status === "RESOLVED") return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded">Resolved</span>;
  return <span className="text-[10px] font-bold text-slate-400 bg-slate-700 border border-slate-600 px-2 py-0.5 rounded">{status}</span>;
}

interface TicketsTabProps {
  tickets: Complaint[];
}

export default function TicketsTab({ tickets }: TicketsTabProps) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <HelpCircle size={36} className="mx-auto mb-3 text-slate-700" />
        <p>No support tickets</p>
      </div>
    );
  }

  return (
    <motion.div
      key="tickets"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="space-y-2"
    >
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="flex items-start gap-4 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl hover:border-slate-600 transition-all"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            ticket.priority === "HIGH" ? "bg-rose-600/20" : ticket.priority === "MEDIUM" ? "bg-amber-600/20" : "bg-slate-700"
          }`}>
            <HelpCircle
              size={15}
              className={ticket.priority === "HIGH" ? "text-rose-400" : ticket.priority === "MEDIUM" ? "text-amber-400" : "text-slate-400"}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <p className="text-sm font-semibold text-white leading-tight">{ticket.subject}</p>
              <ComplaintStatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                ticket.priority === "HIGH" ? "bg-rose-500/20 text-rose-400" : ticket.priority === "MEDIUM" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-400"
              }`}>
                {ticket.priority}
              </span>
              <span className="text-[10px] text-slate-500">{ticket.category}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{ticket.description}</p>
          </div>
          <div className="text-right shrink-0 text-[10px] text-slate-500">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
