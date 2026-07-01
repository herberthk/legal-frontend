"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mic } from "lucide-react";
import type { SimStatus } from "./types";

interface DemoInputBarProps {
  status: SimStatus;
  typedText: string;
}

const PLACEHOLDER: Record<SimStatus, string> = {
  processing: "Processing your question...",
  responding: "AI is responding...",
  idle: "Ask about Ugandan Law...",
  typing: "",
  done: "Ask about Ugandan Law...",
};

export const DemoInputBar = memo(function DemoInputBar({
  status,
  typedText,
}: DemoInputBarProps) {
  const isResponding = status === "responding";
  const isTyping = status === "typing" && !!typedText;

  return (
    <div
      className="px-4 py-3 border-t border-slate-100 dark:border-white/8 bg-white dark:bg-[#0C1221] shrink-0"
      aria-label="Simulated input"
    >
      <div className="h-12 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center px-3 gap-3 shadow-sm">
        {/* Mic icon — glows when AI is responding */}
        <div
          className={`p-1.5 rounded-lg transition-colors ${
            isResponding
              ? "bg-orange-100 dark:bg-orange-900/30"
              : "bg-slate-100 dark:bg-white/10"
          }`}
          aria-hidden="true"
        >
          <Mic
            size={15}
            className={isResponding ? "text-orange-500" : "text-slate-400"}
          />
        </div>

        {/* Text area */}
        <div className="flex-1 text-sm min-w-0 truncate" aria-live="polite" aria-atomic="true">
          {isTyping ? (
            <span className="text-slate-800 dark:text-white font-medium">
              {typedText}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="inline-block w-0.5 h-4 bg-orange-500 rounded-full ml-0.5 align-middle"
                aria-hidden="true"
              />
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">
              {PLACEHOLDER[status]}
            </span>
          )}
        </div>

        {/* Send button — lights up while typing */}
        <motion.div
          animate={{
            backgroundColor: isTyping ? "rgb(249,115,22)" : "rgb(226,232,240)",
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0 dark:bg-white/10"
          aria-hidden="true"
        >
          <ArrowRight
            size={15}
            className={isTyping ? "text-white" : "text-slate-400"}
          />
        </motion.div>
      </div>

      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-2 select-none">
        Simulated demo — no data sent. Try the real thing after sign-up.
      </p>
    </div>
  );
});
