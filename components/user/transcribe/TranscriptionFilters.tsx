import { memo } from "react";
import { Search } from "lucide-react";

type TimeRange = "all" | "24h" | "7d" | "30d";

interface TranscriptionFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}

export const TranscriptionFilters = memo(({
  searchQuery,
  setSearchQuery,
  timeRange,
  setTimeRange,
}: TranscriptionFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
      <div className="flex-1 relative w-full">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-shadow"
        />
      </div>
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-auto">
        {(["all", "24h", "7d", "30d"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
              timeRange === range
                ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            }`}
          >
            {range === "all"
              ? "All Time"
              : range === "24h"
                ? "Last 24h"
                : range === "7d"
                  ? "Last 7 Days"
                  : "Last 30 Days"}
          </button>
        ))}
      </div>
    </div>
  );
});

TranscriptionFilters.displayName = "TranscriptionFilters";
