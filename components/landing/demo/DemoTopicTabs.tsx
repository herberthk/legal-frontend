"use client";

import { memo } from "react";
import type { Topic } from "./types";
import { TOPIC_COLOR_MAP } from "./types";

interface DemoTopicTabsProps {
  topics: Topic[];
  activeTopic: number;
  onSelect: (index: number) => void;
}

export const DemoTopicTabs = memo(function DemoTopicTabs({
  topics,
  activeTopic,
  onSelect,
}: DemoTopicTabsProps) {
  return (
    <div
      className="flex gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-white/8 bg-white dark:bg-[#0C1221] shrink-0 overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Legal topics"
    >
      {topics.map((t, i) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activeTopic === i}
          aria-controls={`demo-panel-${t.id}`}
          onClick={() => onSelect(i)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
            activeTopic === i
              ? TOPIC_COLOR_MAP[t.color]
              : "text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
          }`}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
});
