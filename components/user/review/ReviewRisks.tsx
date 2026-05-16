"use client";

import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

interface ReviewRisksProps {
  risks: ReviewRisk[];
}

const SEVERITY_CONFIG: Record<
  RiskLevel,
  {
    icon: React.ReactNode;
    label: string;
    cardClass: string;
    badgeClass: string;
    headerClass: string;
  }
> = {
  HIGH: {
    icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
    label: "High",
    cardClass:
      "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20",
    badgeClass:
      "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    headerClass: "text-red-800 dark:text-red-200",
  },
  MEDIUM: {
    icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
    label: "Medium",
    cardClass:
      "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20",
    badgeClass:
      "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    headerClass: "text-amber-800 dark:text-amber-200",
  },
  LOW: {
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    label: "Low",
    cardClass:
      "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20",
    badgeClass:
      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    headerClass: "text-emerald-800 dark:text-emerald-200",
  },
};

function RiskCard({ risk, index }: { risk: ReviewRisk; index: number }) {
  const cfg = SEVERITY_CONFIG[risk.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className={`p-5 rounded-2xl border ${cfg.cardClass} space-y-3`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className={`font-bold text-sm ${cfg.headerClass}`}>
              {risk.title}
            </h4>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.badgeClass}`}
            >
              {cfg.label} Severity
            </span>
          </div>
          {risk.clause && (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              Ref: {risk.clause}
            </p>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {risk.description}
          </p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="ml-8 p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-white/80 dark:border-slate-700/50">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
          Recommended Action
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {risk.recommendation}
        </p>
      </div>
    </motion.div>
  );
}

export function ReviewRisks({ risks }: ReviewRisksProps) {
  // Already sorted HIGH → MEDIUM → LOW by the API, but enforce it client-side too
  const sorted = [...risks].sort((a, b) => {
    const order: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.severity] - order[b.severity];
  });

  const highCount = sorted.filter((r) => r.severity === "HIGH").length;
  const medCount = sorted.filter((r) => r.severity === "MEDIUM").length;
  const lowCount = sorted.filter((r) => r.severity === "LOW").length;

  return (
    <div>
      {/* Summary counts */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Identified Risks ({risks.length})
        </h3>
        <div className="flex gap-2 ml-auto">
          {highCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {highCount} High
            </span>
          )}
          {medCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {medCount} Medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {lowCount} Low
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map((risk, i) => (
          <RiskCard key={i} risk={risk} index={i} />
        ))}
      </div>
    </div>
  );
}
