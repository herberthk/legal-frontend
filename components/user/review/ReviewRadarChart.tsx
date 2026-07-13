"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";

interface ReviewRadarChartProps {
  data: ReviewScoreCategory[];
}

function formatCategoryName(cat: string): string {
  const map: Record<string, string> = {
    legalCompliance: "Legal Compliance",
    riskManagement: "Risk Management",
    clarityDrafting: "Clarity & Drafting",
    partyProtection: "Party Protection",
    enforceability: "Enforceability",
    "Legal Compliance": "Legal Compliance",
    "Risk Management": "Risk Management",
    "Clarity & Drafting": "Clarity & Drafting",
    "Party Protection": "Party Protection",
    Enforceability: "Enforceability",
  };
  return map[cat] ?? cat;
}

// Shorten long category names for the axis labels
function shortLabel(cat: string) {
  const formatted = formatCategoryName(cat);
  const map: Record<string, string> = {
    "Legal Compliance": "Compliance",
    "Risk Management": "Risk Mgmt",
    "Clarity & Drafting": "Clarity",
    "Party Protection": "Protection",
    Enforceability: "Enforceable",
  };
  return map[formatted] ?? formatted;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 shadow-lg text-sm">
        <p className="font-bold text-slate-800 dark:text-slate-100">
          {formatCategoryName(payload[0].payload.category)}
        </p>
        <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
          Score: {payload[0].value} / 100
        </p>
      </div>
    );
  }
  return null;
};

export function ReviewRadarChart({ data }: ReviewRadarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: shortLabel(d.category),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-lg"
    >
      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
        Score Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fontSize: 11,
              fontWeight: 600,
              fill: "currentColor",
              className: "fill-slate-500 dark:fill-slate-400",
            }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Category score list */}
      <div className="mt-4 grid grid-cols-1 gap-2">
        {data.map((item) => (
          <div key={item.category} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-400 w-36 shrink-0 font-medium">
              {formatCategoryName(item.category)}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  item.score >= 85
                    ? "bg-emerald-500"
                    : item.score >= 75
                    ? "bg-blue-500"
                    : item.score >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${item.score}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.4 }}
              />
            </div>
            <span
              className={`text-xs font-bold w-8 text-right ${
                item.score >= 85
                  ? "text-emerald-600 dark:text-emerald-400"
                  : item.score >= 75
                  ? "text-blue-600 dark:text-blue-400"
                  : item.score >= 50
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {item.score}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
