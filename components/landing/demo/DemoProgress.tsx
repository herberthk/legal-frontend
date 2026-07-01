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
      {script.map((step, i) => {
        const color = step.topicColor;
        const isPast = i < stepIndex;
        const isCurrent = i === stepIndex && status !== "done";
        
        let bgClass = "bg-slate-200 dark:bg-white/10";
        if (isPast) {
          bgClass = color === "indigo" ? "bg-indigo-500" : color === "emerald" ? "bg-emerald-500" : "bg-orange-500";
        } else if (isCurrent) {
          bgClass = color === "indigo" ? "bg-indigo-300 dark:bg-indigo-700" : color === "emerald" ? "bg-emerald-300 dark:bg-emerald-700" : "bg-orange-300 dark:bg-orange-700";
        }
        
        let textClass = "text-slate-300 dark:text-white/20";
        if (i < stepIndex - 1) {
          textClass = color === "indigo" ? "text-indigo-500" : color === "emerald" ? "text-emerald-500" : "text-orange-500";
        }

        return (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${bgClass}`}
            />
            {i < script.length - 1 && (
              <ChevronRight
                size={10}
                aria-hidden="true"
                className={`shrink-0 ${textClass}`}
              />
            )}
          </div>
        );
      })}
      <span className="text-[10px] text-slate-400 font-medium ml-1 whitespace-nowrap select-none">
        {Math.min(stepIndex, script.length)}/{script.length}
      </span>
    </div>
  );
});
