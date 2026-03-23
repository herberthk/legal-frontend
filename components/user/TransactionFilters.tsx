"use client";
import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";

interface TransactionFiltersProps {
  currentType: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  currentType,
  searchTerm,
  onSearchChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
        {(["ALL", "DEPOSIT", "TEXT_CHAT", "VOICE_SESSION"] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                currentType === type
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
          ),
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative group">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors"
            size={14}
          />
          <input
            type="text"
            placeholder="Search current page..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border-none rounded-full text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500/50 w-full sm:w-48 transition-all placeholder-slate-400"
          />
        </div>
      </div>
    </div>
  );
};

export default TransactionFilters;
