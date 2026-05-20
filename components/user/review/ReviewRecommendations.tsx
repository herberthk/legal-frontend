"use client";

import { motion } from "framer-motion";
import { Lightbulb, ArrowRight } from "lucide-react";

interface ReviewRecommendationsProps {
  recommendations: ReviewRecommendation[];
}

const PRIORITY_CONFIG: Record<
  RiskLevel,
  { label: string; dotClass: string; badgeClass: string }
> = {
  HIGH: {
    label: "High Priority",
    dotClass: "bg-red-500",
    badgeClass:
      "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  MEDIUM: {
    label: "Medium Priority",
    dotClass: "bg-amber-500",
    badgeClass:
      "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  LOW: {
    label: "Low Priority",
    dotClass: "bg-emerald-500",
    badgeClass:
      "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  },
};

export function ReviewRecommendations({
  recommendations,
}: ReviewRecommendationsProps) {
  const sorted = [...recommendations].sort((a, b) => {
    const order: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <div>
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 mt-1">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        Recommendations ({recommendations.length})
      </h3>

      <div className="space-y-3">
        {sorted.map((rec, i) => {
          const cfg = PRIORITY_CONFIG[rec.priority];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Step number */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-300">
                  {i + 1}
                </div>
                {i < sorted.length - 1 && (
                  <div className="w-px h-full min-h-4 bg-slate-100 dark:bg-slate-800" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start gap-2 flex-wrap mb-2">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dotClass}`}
                  />
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex-1">
                    {rec.title}
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badgeClass}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {rec.description}
                </p>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
