// Small, pure presentational atoms — each one is memoized so parent
// re-renders caused by the simulation timer don't cascade into them.

import { memo } from "react";
import { Scale, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Citation Chip                                                        */
/* ------------------------------------------------------------------ */
interface CitationChipProps {
  label: string;
  type?: "act" | "article" | "section";
}

const CHIP_COLORS: Record<string, string> = {
  act: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700",
  article:
    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  section:
    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
};

export const CitationChip = memo(function CitationChip({
  label,
  type = "act",
}: CitationChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${CHIP_COLORS[type]}`}
    >
      <ExternalLink size={9} />
      {label}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/*  Confidence Bar                                                       */
/* ------------------------------------------------------------------ */
export const ConfidenceBar = memo(function ConfidenceBar({
  score,
}: {
  score: number;
}) {
  const barColor =
    score >= 90
      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
      : score >= 75
      ? "bg-gradient-to-r from-amber-400 to-amber-500"
      : "bg-gradient-to-r from-red-400 to-red-500";

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[10px] text-slate-400 font-medium w-16 shrink-0">
        Confidence
      </span>
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-7 text-right">
        {score}%
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  AI Avatar                                                            */
/* ------------------------------------------------------------------ */
export const AIAvatar = memo(function AIAvatar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-linear-to-br from-slate-800 to-slate-900 dark:from-white/10 dark:to-white/5 flex items-center justify-center shrink-0 shadow-lg border border-slate-700/50 dark:border-white/10">
      <Scale className="text-orange-400 w-4 h-4" />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  User Avatar                                                          */
/* ------------------------------------------------------------------ */
export const UserAvatar = memo(function UserAvatar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-linear-to-br from-orange-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg">
      <span className="text-white text-xs font-black">U</span>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Audio Visualiser (shown while AI is "speaking")                     */
/* ------------------------------------------------------------------ */
const BAR_SCALES = [0.4, 0.7, 1, 0.85, 0.5, 0.9, 0.6] as const;

export const AudioVisualiser = memo(function AudioVisualiser() {
  return (
    <div className="flex items-end gap-[2px] h-3.5" aria-hidden="true">
      {BAR_SCALES.map((scale, i) => (
        <motion.div
          key={i}
          animate={{ scaleY: [scale * 0.4, scale, scale * 0.4] }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.07,
            ease: "easeInOut",
          }}
          className="w-[3px] bg-linear-to-t from-orange-500 to-amber-400 rounded-full origin-bottom"
          style={{ height: `${scale * 14}px` }}
        />
      ))}
    </div>
  );
});
