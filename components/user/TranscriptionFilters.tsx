"use client";

import React, { useState, useEffect } from "react";
import { Search, Calendar } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TranscriptionFiltersProps {
  initialSearch: string;
  initialFilter: UsageFilter;
}

const TranscriptionFilters = ({
  initialSearch,
  initialFilter,
}: TranscriptionFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filter, setFilter] = useState<UsageFilter>(initialFilter);

  // Update URL search parameters
  const updateParams = React.useCallback(
    (newParams: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, value]) => {
        if (value !== undefined) {
          // Check for undefined specifically if needed, but null/string is expected
          if (value) {
            params.set(key, value);
          } else {
            params.delete(key);
          }
        }
      });

      // Reset to page 1 on filter/search change
      if (!newParams.page) {
        params.set("page", "1");
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== initialSearch) {
        updateParams({ search: searchQuery || null });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, initialSearch, updateParams]);

  const handleFilterChange = (newFilter: UsageFilter) => {
    setFilter(newFilter);
    updateParams({ filter: newFilter });
  };

  const filterOptions: { label: string; value: UsageFilter }[] = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 Days", value: "last_week" },
    { label: "This Month", value: "month" },
    { label: "All Time", value: "custom" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
            <Calendar size={12} />
            History & Transcripts
          </div>
          <h1 className="md:text-3xl text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Consultation <span className="text-orange-600">Archive</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Access and manage all your past legal consultations, view AI
            summaries, and read full session transcripts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center gap-2 px-4 shadow-sm"
          >
            <Calendar size={18} className="text-slate-400" />
            <span className="hidden sm:inline">Advanced</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              filter === opt.value
                ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TranscriptionFilters;
