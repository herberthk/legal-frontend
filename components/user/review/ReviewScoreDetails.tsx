"use client";

import { motion } from "framer-motion";
import { AlertCircle, Target, CheckCircle2 } from "lucide-react";

interface ReviewScoreDetailsProps {
  scoreBreakdown: ReviewScoreCategory[];
}

function formatCategoryName(cat: string): string {
  const map: Record<string, string> = {
    legalCompliance: "Legal Compliance",
    riskManagement: "Risk Management",
    clarityDrafting: "Clarity & Drafting",
    partyProtection: "Party Protection",
    enforceability: "Enforceability",
  };
  return map[cat] ?? cat;
}

export function ReviewScoreDetails({ scoreBreakdown }: ReviewScoreDetailsProps) {
  // Only show details if at least one category has a reason or recommendation
  const hasDetails = scoreBreakdown.some((cat) => cat.reason || cat.recommendation);

  if (!hasDetails) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="md:p-5 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" />
          Score Improvement Plan
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Detailed analysis of your scores and actionable steps to reach 100%.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {scoreBreakdown.map((item, i) => (
          <motion.div
            key={item.category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {formatCategoryName(item.category)}
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <span
                  className={`text-xs font-bold ${
                    item.score >= 85
                      ? "text-emerald-600 dark:text-emerald-400"
                      : item.score >= 75
                      ? "text-blue-600 dark:text-blue-400"
                      : item.score >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {item.score} / 100
                </span>
              </div>
            </div>

            <div className="space-y-3 mt-2">
              {item.reason && (
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      Current Assessment
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.reason}
                    </p>
                  </div>
                </div>
              )}

              {item.recommendation && (
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                      Recommendation for 100%
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
