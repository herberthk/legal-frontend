"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileTextIcon,
  MicIcon,
  Clock,
  Coins,
  TrendingUp,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getUserUsage } from "@/lib/actions";

const FILTER_OPTIONS: { label: string; value: UsageFilter }[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
];

type Props = {
  userId: string;
};

const UsageHistory = ({ userId }: Props) => {
  const [filter, setFilter] = useState<UsageFilter>("today");
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(records.length / perPage));
  const paginatedRecords = records.slice((page - 1) * perPage, page * perPage);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const customRange =
        filter === "custom" && customStart && customEnd
          ? { start: customStart, end: customEnd }
          : undefined;

      const result = await getUserUsage(userId, filter, customRange);
      setRecords(result.records);
      setTotalTokens(result.totalTokens);
      setTotalCost(result.totalCost);
      setPage(1);
    } catch (err) {
      console.error("Error fetching usage:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, filter, customStart, customEnd]);

  useEffect(() => {
    if (filter !== "custom") {
      fetchUsage();
    }
  }, [filter, fetchUsage]);

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      fetchUsage();
    }
  };

  const getTypeIcon = (type: UsageRecord["type"]) => {
    switch (type) {
      case "TEXT_PROMPT":
      case "TEXT_RESPONSE":
        return <FileTextIcon size={14} />;
      case "VOICE_SESSION":
        return <MicIcon size={14} />;
    }
  };

  const getTypeLabel = (type: UsageRecord["type"]) => {
    switch (type) {
      case "TEXT_PROMPT":
        return "Text Prompt";
      case "TEXT_RESPONSE":
        return "AI Response";
      case "VOICE_SESSION":
        return "Voice Session";
    }
  };

  const getSourceBadge = (source: UsageRecord["source"]) => {
    switch (source) {
      case "free":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold">
            Free
          </span>
        );
      case "welcome":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">
            Welcome
          </span>
        );
      case "paid":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold">
            Paid
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Token Usage History
          </h3>
          <p className="text-xs text-slate-500">
            Track your token consumption over time.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Coins size={12} />
            <span>Total Tokens</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {totalTokens.toLocaleString()}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <TrendingUp size={12} />
            <span>Cost</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            ${totalCost.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter
          size={14}
          className="text-slate-400 shrink-0"
        />
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              filter === opt.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {filter === "custom" && (
        <div className="flex items-end gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Records List */}
      <div className="space-y-1 min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : paginatedRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
            <p>No usage records for this period.</p>
          </div>
        ) : (
          paginatedRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700 group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    record.type === "VOICE_SESSION"
                      ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {getTypeIcon(record.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {getTypeLabel(record.type)}
                    </span>
                    {getSourceBadge(record.source)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Clock size={10} />
                    {new Date(record.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <span className="opacity-50">•</span>
                    {new Date(record.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {record.tokens.toLocaleString()}
                  <span className="text-[10px] text-slate-400 ml-1 font-sans">
                    tokens
                  </span>
                </p>
                {record.cost > 0 && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">
                    -${record.cost.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} className="text-slate-500" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageHistory;
