"use client";

import { memo } from "react";
import { Scale, X } from "lucide-react";

interface DemoHeaderProps {
  onClose: () => void;
}

export const DemoHeader = memo(function DemoHeader({
  onClose,
}: DemoHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/8 bg-slate-50/80 dark:bg-white/3 backdrop-blur-sm shrink-0">
      {/* Left: traffic lights + branding */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
          <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
        </div>
        <div className="flex items-center gap-1.5">
          <Scale size={13} className="text-orange-500" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide">
            LegalAdviser AI
          </span>
          <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-[9px] font-black rounded-full border border-orange-200 dark:border-orange-800 uppercase tracking-widest">
            Live Demo
          </span>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onClose}
          aria-label="Close demo"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
});
