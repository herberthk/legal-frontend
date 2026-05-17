"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSearch,
  Brain,
  BarChart3,
  FileOutput,
  CheckCircle2,
} from "lucide-react";

interface StageConfig {
  key: ReviewStage;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const STAGES: StageConfig[] = [
  {
    key: "uploading",
    label: "Uploading",
    description: "Securely sending your document to the server...",
    icon: <Upload className="w-5 h-5" />,
  },
  {
    key: "extracting",
    label: "Extracting Text",
    description: "Parsing PDF content and extracting all text...",
    icon: <FileSearch className="w-5 h-5" />,
  },
  {
    key: "analyzing",
    label: "Analysing Document",
    description: "Reviewing clauses against Ugandan laws and regulations...",
    icon: <Brain className="w-5 h-5" />,
  },
  {
    key: "scoring",
    label: "Scoring Compliance",
    description: "Computing compliance scores across 5 legal categories...",
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    key: "generating",
    label: "Generating Report",
    description: "Compiling risks, recommendations and final review...",
    icon: <FileOutput className="w-5 h-5" />,
  },
  {
    key: "complete",
    label: "Complete",
    description: "Review ready.",
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
];

const STAGE_ORDER: ReviewStage[] = [
  "uploading",
  "extracting",
  "analyzing",
  "scoring",
  "generating",
  "complete",
];

interface ReviewProcessingProps {
  stage: ReviewStage;
  progress: number;
  fileName?: string;
}

export function ReviewProcessing({
  stage,
  progress,
  fileName,
}: ReviewProcessingProps) {
  const currentIndex = STAGE_ORDER.indexOf(stage);

  const currentConfig = STAGES.find((s) => s.key === stage) ?? STAGES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Processing your document
        </div>
        {fileName && (
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-2 truncate max-w-sm mx-auto">
            {fileName}
          </p>
        )}
        <AnimatePresence mode="wait">
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-slate-700 dark:text-slate-300 font-medium"
          >
            {currentConfig.description}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
          <span>Progress</span>
          <span>{Math.min(progress, 95)}%</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full"
            animate={{ width: `${Math.min(progress, 95)}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Stage steps */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-6">
        <div className="space-y-1">
          {STAGES.map((s, i) => {
            const isDone = i < currentIndex;
            const isActive = i === currentIndex;
            const isPending = i > currentIndex;

            return (
              <motion.div
                key={s.key}
                initial={false}
                animate={{
                  opacity: isPending ? 0.35 : 1,
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : "bg-transparent"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                      : isActive
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      {s.icon}
                    </motion.div>
                  ) : (
                    s.icon
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      isDone
                        ? "text-emerald-700 dark:text-emerald-400"
                        : isActive
                          ? "text-slate-900 dark:text-slate-50"
                          : "text-slate-400 dark:text-slate-600"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>

                {/* Status dot */}
                {isActive && (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                  />
                )}
                {isDone && (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
        Deep legal analysis may take up to 60 seconds for complex documents.
      </p>
    </motion.div>
  );
}
