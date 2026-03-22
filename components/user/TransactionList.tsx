"use client";
import React, { useState } from "react";
import {
  Download,
  Filter,
  Search,
  Activity,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Server,
  Clock,
  Receipt,
  CreditCard,
} from "lucide-react";

interface TransactionListProps {
  transactions: Transaction[];
  onArchive: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onArchive,
}) => {
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Filter State
  const [filterType, setFilterType] = useState<
    "ALL" | "DEPOSIT" | "TEXT_CHAT" | "VOICE_SESSION"
  >("ALL");
  const [filterDateRange, setFilterDateRange] = useState<
    "ALL_TIME" | "7_DAYS" | "30_DAYS"
  >("ALL_TIME");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Filtering Logic
  const filteredTransactions = transactions.filter((t) => {
    // 1. Filter by Type
    if (filterType !== "ALL" && t.type !== filterType) return false;

    // 2. Filter by Date
    if (filterDateRange !== "ALL_TIME") {
      const txDate = new Date(t.date);
      const now = new Date("2024-01-01"); // Fixed for mock consistency
      const diffTime = Math.abs(now.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filterDateRange === "7_DAYS" && diffDays > 7) return false;
      if (filterDateRange === "30_DAYS" && diffDays > 30) return false;
    }

    // 3. Filter by Search
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(lowerTerm);
      const matchId = t.id.toLowerCase().includes(lowerTerm);
      if (!matchDesc && !matchId) return false;
    }

    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const toggleExpand = (id: string) => {
    setExpandedTxId(expandedTxId === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Transaction History
        </h3>
        <button className="text-sm text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 transition-colors hover:text-orange-700">
          <Download size={14} /> Download Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {(
            ["ALL", "DEPOSIT", "TEXT_CHAT", "VOICE_SESSION"] as const
          ).map((type) => (
            <button
              key={type}
              onClick={() => {
                setFilterType(type);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === type
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {type === "ALL"
                ? "All Transactions"
                : type
                    .replace("_", " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative group">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
              size={14}
            />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border-none rounded-full text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/50 w-full sm:w-48 transition-all placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterDateRange}
              onChange={(e) => {
                setFilterDateRange(
                  e.target.value as "ALL_TIME" | "7_DAYS" | "30_DAYS",
                );
                setCurrentPage(1);
              }}
              className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:text-orange-600 transition-colors"
            >
              <option className="bg-white dark:bg-slate-800" value="ALL_TIME">
                All Time
              </option>
              <option className="bg-white dark:bg-slate-800" value="7_DAYS">
                Last 7 Days
              </option>
              <option className="bg-white dark:bg-slate-800" value="30_DAYS">
                Last 30 Days
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {currentTransactions.length > 0 ? (
              currentTransactions.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    onClick={() => toggleExpand(t.id)}
                    className={`transition-colors duration-200 animate-in fade-in slide-in-from-left-2 cursor-pointer ${
                      expandedTxId === t.id
                        ? "bg-slate-50 dark:bg-slate-700/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full transition-colors ${
                            t.type === "DEPOSIT"
                              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                              : t.type === "VOICE_SESSION"
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
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
                              <ChevronDown
                                size={14}
                                className="text-slate-400"
                              />
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{t.details}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {t.date}
                    </td>
                    <td
                      className={`px-6 py-4 font-mono text-sm font-medium ${t.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}
                    >
                      {t.amount > 0 ? "+" : ""}
                      {parseFloat(t.amount.toString()).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
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
                      <td colSpan={4} className="px-6 pb-6 pt-2">
                        <div className="ml-14 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {t.type === "TEXT_CHAT" && (
                            <>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded">
                                  <Server size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Tokens
                                  </span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    In: 850 / Out: 350
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                                  <Clock size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Processing Time
                                  </span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    1.24s
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded">
                                  <Activity size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Model
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    Gemini 2.5 Flash
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                          {t.type === "VOICE_SESSION" && (
                            <>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded">
                                  <Clock size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Duration
                                  </span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {t.details}
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-500 rounded">
                                  <DollarSign size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Rate
                                  </span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    $0.05/min
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded">
                                  <Activity size={16} />
                                </div>
                                <div>
                                  <span className="text-xs text-slate-500 block">
                                    Voice ID
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    Kore (Standard)
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
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
                                    TXN-{t.id.toUpperCase()}
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
                                    {t.description
                                      .split("(")[1]
                                      ?.replace(")", "") || "Direct"}
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
                  No transactions found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <span className="text-xs text-slate-500">
          Page {currentPage} of {Math.max(1, totalPages)}
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
          >
            <ChevronLeft
              size={20}
              className="text-slate-600 dark:text-slate-400"
            />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
          >
            <ChevronRight
              size={20}
              className="text-slate-600 dark:text-slate-400"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionList;
