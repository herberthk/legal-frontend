import { FileTextIcon, generateUserTransactions, MicIcon } from "@/constants";
import { DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";

const TransactionList = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(
    generateUserTransactions(20),
  );

  // Transaction Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const currentTransactions = transactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Recent Activity
        </h3>
        <span className="text-xs text-slate-500">
          Page {currentPage} of {totalPages}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {currentTransactions.map((tx) => (
          <div
            key={tx.id}
            className="p-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-200 cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-full transition-colors ${
                  tx.type === "DEPOSIT"
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : tx.type === "VOICE_SESSION"
                      ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {tx.type === "DEPOSIT" ? (
                  <DollarSign size={16} />
                ) : tx.type === "VOICE_SESSION" ? (
                  <MicIcon size={16} />
                ) : (
                  <FileTextIcon size={16} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {tx.description}
                </p>
                <p className="text-xs text-slate-500">
                  {tx.date} • {tx.details}
                </p>
              </div>
            </div>
            <span
              className={`font-mono text-sm font-medium ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300"}`}
            >
              {tx.amount > 0 ? "+" : ""}
              {tx.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <ChevronLeft
            size={20}
            className="text-slate-600 dark:text-slate-400"
          />
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalPages })
            .slice(0, 5)
            .map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-6 h-6 rounded text-xs flex items-center justify-center transition-colors ${currentPage === i + 1 ? "bg-orange-500 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"}`}
              >
                {i + 1}
              </button>
            ))}
        </div>
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <ChevronRight
            size={20}
            className="text-slate-600 dark:text-slate-400"
          />
        </button>
      </div>
    </div>
  );
};

export default TransactionList;
