"use client";

import { forwardRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gavel, Loader2, RefreshCw, Sparkles, Pause, Play } from "lucide-react";
import { AIAvatar, UserAvatar, AudioVisualiser, CitationChip, ConfidenceBar } from "./DemoAtoms";
import type { Message, SimStatus } from "./types";
import { DEMO_INTRO } from "./topics";

interface DemoChatProps {
  messages: Message[];
  status: SimStatus;
  isComplete: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
}

/** Single AI message bubble */
const AIBubble = memo(function AIBubble({
  msg,
  isLast,
  status,
}: {
  msg: Extract<Message, { role: "ai" }>;
  isLast: boolean;
  status: SimStatus;
}) {
  const step = msg.content;
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-3 shadow-sm space-y-2.5 flex-1 min-w-0">
      {/* Citations */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {step.citations.map((c) => (
          <CitationChip
            key={c}
            label={c}
            type={
              c.toLowerCase().includes("article")
                ? "article"
                : c.toLowerCase().includes("s.")
                ? "section"
                : "act"
            }
          />
        ))}
      </div>

      {/* Answer body */}
      <div>{step.answer}</div>

      {/* Confidence score */}
      <ConfidenceBar score={step.confidence} />

      {/* Speaking indicator — only on the last AI message while responding */}
      {isLast && status === "responding" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 pt-1"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Reading aloud
          </span>
          <AudioVisualiser />
        </motion.div>
      )}
    </div>
  );
});

/** Single user message bubble */
const UserBubble = memo(function UserBubble({ content }: { content: string }) {
  return (
    <div className="bg-linear-to-br from-orange-500 to-amber-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-medium shadow-lg shadow-orange-500/20">
      {content}
    </div>
  );
});

/** The full scrollable chat area */
export const DemoChat = forwardRef<HTMLDivElement, DemoChatProps>(
  function DemoChat(
    { messages, status, isComplete, isPaused, onTogglePause, onRestart },
    ref
  ) {
    return (
      <div className="flex-1 relative min-h-0 flex flex-col">
        <div
          ref={ref}
          role="log"
          aria-live="polite"
        aria-label="Chat conversation"
        className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10"
      >
        {/* ---- Greeting ---- */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-start gap-3 max-w-[92%]"
        >
          <AIAvatar />
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-orange-400" aria-hidden="true" />
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                LegalAdviser AI
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {DEMO_INTRO}
            </p>
          </div>
        </motion.div>

        {/* ---- Message bubbles ---- */}
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isLastAI = !isUser && idx === messages.length - 1;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className={`flex items-start gap-3 ${
                  isUser
                    ? "flex-row-reverse ml-auto max-w-[85%] sm:max-w-[80%]"
                    : "max-w-[92%]"
                }`}
              >
                {isUser ? <UserAvatar /> : <AIAvatar />}
                {isUser ? (
                  <UserBubble content={msg.content} />
                ) : (
                  <AIBubble
                    msg={msg as Extract<Message, { role: "ai" }>}
                    isLast={isLastAI}
                    status={status}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ---- Processing indicator ---- */}
        <AnimatePresence>
          {status === "processing" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-3 ml-12"
            >
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2">
                <Loader2 size={13} className="animate-spin text-orange-500" />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Searching Uganda Law Database...
                </span>
                <div className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 h-1 rounded-full bg-orange-400"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- Completion banner ---- */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 py-3"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 w-full">
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
                <span className="flex items-center gap-1.5 px-3">
                  <Gavel size={11} className="text-orange-500" aria-hidden="true" />
                  Demo complete
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
              </div>
              <button
                onClick={onRestart}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <RefreshCw size={11} />
                Replay Full Demo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* ---- Floating Control Pill ---- */}
        {!isComplete && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 z-10">
            <button
              onClick={onTogglePause}
              className="flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-200 text-xs font-bold"
            >
              {isPaused ? (
                <>
                  <Play size={12} className="text-emerald-500" fill="currentColor" />
                  Resume
                </>
              ) : (
                <>
                  <Pause size={12} className="text-orange-500" fill="currentColor" />
                  Pause
                </>
              )}
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-white/20 mx-1" />
            <button
              onClick={onRestart}
              title="Restart from beginning"
              className="p-1.5 mr-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }
);
