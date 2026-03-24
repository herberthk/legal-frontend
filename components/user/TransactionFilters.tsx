"use client";
import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";

interface TransactionFiltersProps {
  currentType: string;
  currentDuration: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const DURATION_OPTIONS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_week" },
  { label: "This Month", value: "month" },
];

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  currentType,
  currentDuration,
  searchTerm,
  onSearchChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {(["ALL", "DEPOSIT"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleFilterChange("type", type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                currentType === type
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {type === "ALL" ? "All Transactions" : "Deposits"}
            </button>
          ))}
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700" />

        {/* Duration Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <div className="relative w-full sm:w-auto">
            <select
              value={currentDuration}
              onChange={(e) => handleFilterChange("duration", e.target.value)}
              className="appearance-none block w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-medium text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 cursor-pointer transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="S19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group w-full sm:w-auto">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
            size={14}
          />
          <input
            type="text"
            placeholder="Search reference or description..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border-none rounded-full text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/50 w-full sm:w-48 transition-all placeholder:text-[10px]"
          />
        </div>
      </div>
    </div>
  );
};

export default TransactionFilters;
