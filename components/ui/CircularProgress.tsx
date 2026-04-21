"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CircularProgressProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#4f46e5", // indigo-600
  className = "",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background track */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-200 dark:text-slate-800"
        />

        {/* Animated progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          strokeLinecap="round"
        />

        {/* Glow effect */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          strokeLinecap="round"
          className="blur-xs opacity-50"
        />
      </svg>

      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          <motion.span
            key={progress}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-sm font-bold font-mono bg-clip-text text-transparent bg-linear-to-br from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 leading-none"
          >
            {Math.round(progress)}%
          </motion.span>
          <span className="text-[9px] tracking-widest text-slate-500 font-bold mt-1">
            Uploading
          </span>
        </div>
      </div>

      {/* Decorative pulse ring when near completion */}
      <AnimatePresence>
        {progress > 0 && progress < 100 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.2 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border-2 border-indigo-500"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
