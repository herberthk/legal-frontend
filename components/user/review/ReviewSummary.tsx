"use client";

import { motion } from "framer-motion";
import { FileText, Star } from "lucide-react";

interface ReviewSummaryProps {
  documentType: string;
  summary: string;
  highlights: string[];
  fileName: string;
  pageCount: number;
  tokensUsed: number;
}

export function ReviewSummary({
  documentType,
  summary,
  highlights,
  fileName,
  pageCount,
  tokensUsed,
}: ReviewSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-4"
    >
      {/* Document meta header */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {fileName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {pageCount} {pageCount === 1 ? "page" : "pages"} · {tokensUsed.toLocaleString()} tokens used
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
          {documentType}
        </span>
      </div>

      {/* Summary card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
          Document Summary
        </h3>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
          {summary}
        </p>
      </div>

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            Highlights
          </h3>
          <ul className="space-y-2">
            {highlights.map((h, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {h}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
