"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface ReviewClausesProps {
  clauses: ReviewClause[];
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, { label: string; className: string }> = {
    HIGH: {
      label: "High Risk",
      className:
        "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    },
    MEDIUM: {
      label: "Medium Risk",
      className:
        "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    },
    LOW: {
      label: "Low Risk",
      className:
        "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    },
  };
  const { label, className } = map[level];
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${className}`}>
      {label}
    </span>
  );
}

function RiskIcon({ level }: { level: RiskLevel }) {
  if (level === "HIGH")
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  if (level === "MEDIUM")
    return <Info className="w-4 h-4 text-amber-500" />;
  return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
}

function ClauseCard({ clause, index }: { clause: ReviewClause; index: number }) {
  const [open, setOpen] = useState(false);

  const leftBorder: Record<RiskLevel, string> = {
    HIGH: "border-l-red-400 dark:border-l-red-600",
    MEDIUM: "border-l-amber-400 dark:border-l-amber-600",
    LOW: "border-l-emerald-400 dark:border-l-emerald-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 border-l-4 ${leftBorder[clause.riskLevel]} shadow-sm overflow-hidden`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <RiskIcon level={clause.riskLevel} />
        <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100 text-sm">
          {clause.title}
        </span>
        <RiskBadge level={clause.riskLevel} />
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-300 shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                  Clause Content
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  &ldquo;{clause.content}&rdquo;
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                  Legal Assessment
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {clause.assessment}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ReviewClauses({ clauses }: ReviewClausesProps) {
  // Sort: HIGH first, then MEDIUM, then LOW
  const sorted = [...clauses].sort((a, b) => {
    const order: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.riskLevel] - order[b.riskLevel];
  });

  return (
    <div>
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 mt-1">
        Key Clauses ({clauses.length})
      </h3>
      <div className="space-y-3">
        {sorted.map((clause, i) => (
          <ClauseCard key={i} clause={clause} index={i} />
        ))}
      </div>
    </div>
  );
}
