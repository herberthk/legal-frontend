"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  DollarSign, Mic, MessageSquare, CreditCard,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";

function TransactionMethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; class: string }> = {
    STRIPE: { label: "Stripe", class: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
    MTN: { label: "MTN", class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    AIRTEL: { label: "Airtel", class: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const m = map[method] ?? { label: method, class: "bg-slate-700 text-slate-400 border-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${m.class}`}>
      {m.label}
    </span>
  );
}

interface TransactionsTabProps {
  transactions: Transaction[];
}

export default function TransactionsTab({ transactions }: TransactionsTabProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <CreditCard size={36} className="mx-auto mb-3 text-slate-700" />
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <motion.div
      key="transactions"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="space-y-2"
    >
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center gap-4 p-3.5 bg-slate-800/60 border border-slate-700/40 rounded-xl hover:border-slate-600 transition-all"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            tx.type === "DEPOSIT" ? "bg-green-600/20" : tx.type === "VOICE_SESSION" ? "bg-purple-600/20" : "bg-blue-600/20"
          }`}>
            {tx.type === "DEPOSIT" ? (
              <DollarSign size={15} className="text-green-400" />
            ) : tx.type === "VOICE_SESSION" ? (
              <Mic size={15} className="text-purple-400" />
            ) : (
              <MessageSquare size={15} className="text-blue-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{tx.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <TransactionMethodBadge method={tx.method} />
              <p className="text-xs text-slate-500">{tx.details}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold ${tx.type === "DEPOSIT" ? "text-green-400" : "text-rose-400"}`}>
              {tx.type === "DEPOSIT" ? "+" : "-"}${((tx.amount ?? 0) / 100).toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {new Date(tx.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </p>
          </div>
          <div className="shrink-0">
            {tx.status === "COMPLETED" ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : tx.status === "FAILED" ? (
              <XCircle size={16} className="text-rose-400" />
            ) : (
              <Clock size={16} className="text-amber-400" />
            )}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
