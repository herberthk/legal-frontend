"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Calendar,
  ArrowUpRight,
  Gift,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface FreeCreditListProps {
  records: FreeCreditHistory[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

const FreeCreditList: React.FC<FreeCreditListProps> = ({
  records,
  currentPage,
  totalPages,
  totalCount,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
          <Sparkles size={40} className="text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          No Credit History Yet
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Your free token renewal history will appear here once your first cycle
          completes or you receive a bonus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {records.map((record, index) => (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 hover:border-amber-200 dark:hover:border-amber-900/50"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    record.type === "WELCOME"
                      ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                      : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {record.type === "WELCOME" ? (
                    <Gift size={24} />
                  ) : (
                    <RefreshCw size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                      {record.type === "WELCOME"
                        ? "Welcome Bonus"
                        : "3-Day Renewal"}
                    </h4>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                        record.type === "WELCOME"
                          ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                          : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {record.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {format(
                        new Date(record.createdAt),
                        "MMM d, yyyy • h:mm a",
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-xl tracking-tighter">
                  <ArrowUpRight size={18} />+{record.amount.toLocaleString()}
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-1 tracking-normal">
                    TOKENS
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                  CREDITED SUCCESS
                </p>
              </div>
            </div>

            {/* Subtle background glow on hover */}
            <div
              className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl pointer-events-none ${
                record.type === "WELCOME" ? "bg-purple-500" : "bg-amber-500"
              }`}
            />
          </motion.div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mt-4">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Page {currentPage} of {Math.max(1, totalPages)}{" "}
          <span className="mx-2">•</span> {totalCount} Records
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-white dark:hover:bg-slate-900 active:scale-95"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-white dark:hover:bg-slate-900 active:scale-95"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeCreditList;
