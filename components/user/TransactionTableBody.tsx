"use client";
import React, { useState } from "react";
import {
  Activity,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Receipt,
  CreditCard,
  Trash2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import Link from "next/link";

interface TransactionTableBodyProps {
  transactions: Transaction[];
  onArchive: (id: string) => void;
  searchTerm: string;
}

const TransactionTableBody: React.FC<TransactionTableBodyProps> = ({
  transactions,
  onArchive,
  searchTerm,
}) => {
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedTxId(expandedTxId === id ? null : id);
  };

  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, text: string, txId: string) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTxId(txId);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(lowerTerm);
      const matchId = t.id.toLowerCase().includes(lowerTerm);
      const matchRef = t.reference?.toLowerCase().includes(lowerTerm);
      if (!matchDesc && !matchId && !matchRef) return false;
    }
    return true;
  });

  return (
    <>
      {filteredTransactions.length > 0 ? (
        filteredTransactions.map((t) => (
          <React.Fragment key={t.id}>
            <tr
              onClick={() => toggleExpand(t.id)}
              className={`transition-colors duration-200 animate-in fade-in slide-in-from-left-2 cursor-pointer ${
                expandedTxId === t.id
                  ? "bg-slate-50 dark:bg-slate-700/40"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
              }`}
            >
              <td className="p-2 md:px-6 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full transition-colors ${
                      t.type === "DEPOSIT"
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {t.type === "DEPOSIT" ? (
                      <DollarSign size={16} />
                    ) : (
                      <Activity size={16} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white text-sm">
                        {searchTerm &&
                        t.description
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ? (
                          <>
                            {t.description
                              .split(new RegExp(`(${searchTerm})`, "gi"))
                              .map((part, i) =>
                                part.toLowerCase() ===
                                searchTerm.toLowerCase() ? (
                                  <span
                                    key={i}
                                    className="bg-yellow-200 dark:bg-yellow-900/50"
                                  >
                                    {part}
                                  </span>
                                ) : (
                                  part
                                ),
                              )}
                          </>
                        ) : (
                          t.description
                        )}
                      </p>
                      {expandedTxId === t.id ? (
                        <ChevronUp size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{t.details}</p>
                  </div>
                </div>
              </td>
              <td className="p-2 md:px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                {formatDate(t.createdAt)}
              </td>
              <td
                className={`p-2 md:px-6 py-4 font-mono text-sm font-medium ${t.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}
              >
                {t.amount > 0 ? "+" : ""}$
                {parseFloat((t.amount / 100).toString()).toFixed(2)} (UGX{" "}
                {((t.amount / 100) * USD_TO_UGX_EXCHANGE_RATE).toLocaleString()}
                )
              </td>
              <td className="p-2 md:px-6 py-4 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(t.id);
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Archive"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
            {expandedTxId === t.id && (
              <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-t-0 border-b border-slate-100 dark:border-slate-800 transition-all duration-300">
                <td colSpan={4} className="p-4 md:p-6 pb-6 pt-2">
                  <div className="ml-2 md:ml-14 bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-3 duration-300 fade-in">
                    {/* Column 1: Reference & Timing */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                          Transaction Reference
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 select-all">
                            {t.reference || t.id}
                          </span>
                          <button
                            onClick={(e) => handleCopy(e, t.reference || t.id, t.id)}
                            className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-slate-700/80 active:scale-95 shrink-0"
                            title="Copy Reference"
                          >
                            {copiedTxId === t.id ? (
                              <Check size={13} className="text-emerald-500 animate-in zoom-in-50" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                          Settled On
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {new Date(t.createdAt).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Specific Details */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                          Activity &amp; Purpose
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {t.type === "DEPOSIT"
                              ? "Wallet Funds Deposit"
                              : t.type === "TEXT_CHAT"
                              ? "AI Text Consultation"
                              : "Voice AI Session"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                          Usage / Metadata
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block max-w-xs">
                          {t.details || "Instant debit for active consultations."}
                          {t.method && ` • Gateway: ${t.method}`}
                        </span>
                      </div>
                    </div>

                    {/* Column 3: Status & Interactive Action */}
                    <div className="flex flex-col justify-between h-full space-y-4 md:space-y-0">
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                          Status
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            t.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : t.status === "failed"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            t.status === "completed"
                              ? "bg-emerald-500"
                              : t.status === "failed"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`} />
                          {t.status}
                        </span>
                      </div>

                      <div className="pt-2 md:pt-0">
                        <Link
                          href={`/dashboard/user/transactions/${t.id}`}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-indigo-600 hover:from-orange-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group transform active:scale-[0.98]"
                        >
                          View Full Details &amp; Receipt
                          <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))
      ) : (
        <tr>
          <td
            colSpan={4}
            className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
          >
            No transactions found matching your search.
          </td>
        </tr>
      )}
    </>
  );
};

export default TransactionTableBody;
