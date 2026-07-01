"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";
import type { ScriptStep, SimStatus } from "./types";

interface DemoProgressProps {
  script: ScriptStep[];
  stepIndex: number;
  status: SimStatus;
}

export const DemoProgress = memo(function DemoProgress({
  script,
  stepIndex,
  status,
}: DemoProgressProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-white/2 shrink-0"
      aria-label={`Step ${Math.min(stepIndex, script.length)} of ${script.length}`}
      role="progressbar"
      aria-valuenow={Math.min(stepIndex, script.length)}
      aria-valuemin={0}
      aria-valuemax={script.length}
    >
      {script.map((_, i) => (
        <div key={i} className="flex items-center gap-2 flex-1">
          <div
            className={`flex-1 h-1 rounded-full transition-all duration-500 ${
              i < stepIndex
                ? "bg-orange-500"
                : i === stepIndex && status !== "done"
                ? "bg-orange-300 dark:bg-orange-700"
                : "bg-slate-200 dark:bg-white/10"
            }`}
          />
          {i < script.length - 1 && (
            <ChevronRight
              size={10}
              aria-hidden="true"
              className={`shrink-0 ${
                i < stepIndex - 1
                  ? "text-orange-500"
                  : "text-slate-300 dark:text-white/20"
              }`}
            />
          )}
        </div>
      ))}
      <span className="text-[10px] text-slate-400 font-medium ml-1 whitespace-nowrap select-none">
        {Math.min(stepIndex, script.length)}/{script.length}
      </span>
    </div>
  );
});
