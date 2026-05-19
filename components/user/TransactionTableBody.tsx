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
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

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
              <tr className="bg-slate-50 dark:bg-slate-700/20 animate-in fade-in slide-in-from-top-1 duration-200">
                <td colSpan={4} className="p-2 md:px-6 pb-6 pt-2">
                  <div className="ml-2 md:ml-14 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {t.type === "DEPOSIT" && (
                      <>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                          <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-500 rounded">
                            <Receipt size={16} />
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">
                              Ref ID
                            </span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                              {t.reference}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                          <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                            <CreditCard size={16} />
                          </div>
                          <div>
                            <span className="text-xs text-slate-500 block">
                              Method
                            </span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {t.description.split("(")[1]?.replace(")", "") ||
                                "Direct"}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
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
