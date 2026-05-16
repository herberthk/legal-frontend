"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ReviewScoreGaugeProps {
  score: number; // 0-100
}

function getScoreColor(score: number) {
  if (score >= 75) return { stroke: "#10b981", text: "text-emerald-600 dark:text-emerald-400", label: "Excellent", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" };
  if (score >= 50) return { stroke: "#f59e0b", text: "text-amber-600 dark:text-amber-400", label: "Fair", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800" };
  return { stroke: "#ef4444", text: "text-red-600 dark:text-red-400", label: "Poor", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800" };
}

export function ReviewScoreGauge({ score }: ReviewScoreGaugeProps) {
  const colors = getScoreColor(score);
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const dashOffset = circumference - (score / 100) * circumference;

  const canvasRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.strokeDashoffset = String(dashOffset);
    }
  }, [dashOffset]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`flex flex-col items-center gap-3 p-6 rounded-2xl border ${colors.bg} ${colors.border}`}
    >
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        Overall Compliance Score
      </p>

      {/* Circular SVG gauge */}
      <div className="relative">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          {/* Background ring */}
          <circle
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Score arc */}
          <motion.circle
            ref={canvasRef}
            stroke={colors.stroke}
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Center score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className={`text-4xl font-black ${colors.text}`}
          >
            {score}
          </motion.span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
            / 100
          </span>
        </div>
      </div>

      {/* Label badge */}
      <span
        className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${colors.text} ${colors.bg} border ${colors.border}`}
      >
        {colors.label}
      </span>
    </motion.div>
  );
}
