"use client";

import { motion, AnimatePresence } from "framer-motion";

import {
  Upload,
  Brain,
  BarChart3,
  FileOutput,
  CheckCircle2,
  Scan,
  Sparkles,
} from "lucide-react";


interface StageConfig {
  key: ReviewStage;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const STAGES: StageConfig[] = [
  {
    key: "uploading",
    label: "Uploading",
    description: "Securely transferring your document...",
    icon: <Upload className="w-4 h-4" />,
    color: "from-blue-500 to-indigo-500",
  },
  {
    key: "extracting",
    label: "Extracting Text",
    description: "Parsing and digitising document content...",
    icon: <Scan className="w-4 h-4" />,
    color: "from-violet-500 to-purple-500",
  },
  {
    key: "analyzing",
    label: "Analysing Document",
    description: "Cross-referencing clauses with Ugandan law...",
    icon: <Brain className="w-4 h-4" />,
    color: "from-orange-500 to-amber-500",
  },
  {
    key: "scoring",
    label: "Scoring Compliance",
    description: "Computing scores across 5 legal categories...",
    icon: <BarChart3 className="w-4 h-4" />,
    color: "from-emerald-500 to-teal-500",
  },
  {
    key: "generating",
    label: "Generating Report",
    description: "Compiling risks, recommendations and review...",
    icon: <FileOutput className="w-4 h-4" />,
    color: "from-pink-500 to-rose-500",
  },
  {
    key: "complete",
    label: "Complete",
    description: "Review is ready.",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "from-orange-500 to-orange-400",
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

// ── Floating particle dot ──────────────────────────────────────────────────────
function Particle({ delay, duration, x, y }: { delay: number; duration: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-orange-400/60"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
        y: [0, -30, -60],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

const PARTICLES = [
  { x: 15, y: 70, delay: 0, duration: 2.4 },
  { x: 35, y: 80, delay: 0.6, duration: 2.8 },
  { x: 55, y: 75, delay: 1.1, duration: 2.2 },
  { x: 72, y: 82, delay: 0.3, duration: 3.0 },
  { x: 85, y: 68, delay: 1.7, duration: 2.6 },
  { x: 25, y: 60, delay: 0.9, duration: 2.0 },
  { x: 65, y: 55, delay: 1.4, duration: 2.9 },
];

// ── Animated scan beam over a document silhouette ─────────────────────────────
function DocumentScanner({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative w-28 h-36 mx-auto">
      {/* Document silhouette */}
      <div className="absolute inset-0 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        {/* Document lines */}
        <div className="p-3 space-y-1.5 mt-1">
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-3/4" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-full" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-5/6" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-full" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-2/3" />
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 w-full" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-4/5" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-full" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-3/5" />
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 w-full" />
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 w-5/6" />
        </div>

        {/* Scan beam */}
        {isActive && (
          <motion.div
            className="absolute left-0 right-0 h-0.5 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.8) 30%, rgba(249,115,22,1) 50%, rgba(249,115,22,0.8) 70%, transparent 100%)",
              boxShadow: "0 0 12px 3px rgba(249,115,22,0.5)",
            }}
            animate={{ top: ["8%", "92%", "8%"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Scanned overlay that follows beam */}
        {isActive && (
          <motion.div
            className="absolute left-0 right-0 top-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(249,115,22,0.06) 0%, transparent 100%)",
            }}
            animate={{ height: ["8%", "92%", "8%"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>

      {/* Corner fold */}
      <div
        className="absolute top-0 right-0 w-6 h-6"
        style={{
          background:
            "linear-gradient(225deg, #e2e8f0 50%, white 50%)",
        }}
      />

      {/* Orange glow pulse behind document */}
      {isActive && (
        <motion.div
          className="absolute -inset-3 rounded-xl bg-orange-500/10 -z-10"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}

// ── AI brain ring ──────────────────────────────────────────────────────────────
function AIBrainRing({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
      {/* Outer ring */}
      {isActive && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-orange-400/40"
            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-orange-300/30"
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, delay: 0.5, repeat: Infinity }}
          />
        </>
      )}
      {/* Inner circle */}
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${
          isActive
            ? "bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/40"
            : "bg-slate-100 dark:bg-slate-800"
        }`}
      >
        <Brain
          className={`w-7 h-7 transition-colors duration-500 ${isActive ? "text-white" : "text-slate-400"}`}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
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
  const isScanning = stage === "extracting";
  const isAnalyzing = stage === "analyzing";
  const isComplete = stage === "complete";
  const displayProgress = Math.min(progress, isComplete ? 100 : 95);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      {/* ── Hero section ── */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-300 text-sm font-semibold mb-5"
        >
          <motion.span
            className="w-2 h-2 rounded-full bg-orange-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          AI Legal Analysis in Progress
        </motion.div>

        {fileName && (
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-3 truncate max-w-xs mx-auto font-medium">
            📄 {fileName}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.h3
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-1"
          >
            {currentConfig.label}
          </motion.h3>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.p
            key={`desc-${stage}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            {currentConfig.description}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── Central visual ── */}
      <div className="relative mb-8 flex justify-center">
        {/* Particle field */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p, i) => (
            <Particle key={i} {...p} />
          ))}
        </div>

        <div className="relative flex flex-col items-center gap-6">
          {/* Document scanner or brain ring depending on stage */}
          <AnimatePresence mode="wait">
            {isScanning ? (
              <motion.div
                key="scanner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <DocumentScanner isActive />
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div
                key="brain"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <AIBrainRing isActive />
              </motion.div>
            ) : (
              <motion.div
                key="icon-generic"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative"
              >
                {/* Spinning ring for active stages */}
                {!isComplete && (
                  <motion.div
                    className="absolute -inset-3 rounded-full border-2 border-dashed border-orange-300/50"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-500 ${
                    isComplete
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30"
                      : "bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/30"
                  }`}
                >
                  <motion.div
                    animate={isComplete ? {} : { rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-white"
                  >
                    {isComplete ? (
                      <Sparkles className="w-8 h-8" />
                    ) : (
                      currentConfig.icon
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-6">
        <div className="flex justify-between items-center text-xs font-semibold mb-2">
          <span className="text-slate-500 dark:text-slate-400">Analysis Progress</span>
          <motion.span
            key={displayProgress}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-orange-600 dark:text-orange-400 tabular-nums"
          >
            {displayProgress}%
          </motion.span>
        </div>
        {/* Track */}
        <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          {/* Fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-orange-600 via-orange-400 to-amber-400"
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          />
          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-y-0 w-16 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            }}
            animate={{ left: ["-10%", "110%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.5 }}
          />
        </div>
      </div>

      {/* ── Stage pipeline ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
        <div className="p-1">
          {STAGES.map((s, i) => {
            const isDone = i < currentIndex;
            const isActive = i === currentIndex;
            const isPending = i > currentIndex;

            return (
              <motion.div
                key={s.key}
                initial={false}
                animate={{ opacity: isPending ? 0.3 : 1 }}
                transition={{ duration: 0.4 }}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive ? "bg-orange-50 dark:bg-orange-950/30" : ""
                }`}
              >
                {/* Active glow strip on left edge */}
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-orange-500"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}

                {/* Icon chip */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-500 ${
                    isDone
                      ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                      : isActive
                        ? `bg-gradient-to-br ${s.color} text-white shadow-md`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
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
                    className={`text-sm font-semibold leading-none ${
                      isDone
                        ? "text-orange-600 dark:text-orange-400"
                        : isActive
                          ? "text-slate-900 dark:text-slate-50"
                          : "text-slate-400 dark:text-slate-600"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>

                {/* Status indicator */}
                {isDone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full bg-orange-400 shrink-0"
                  />
                )}
                {isActive && (
                  <motion.div
                    className="flex gap-0.5 shrink-0"
                  >
                    {[0, 1, 2].map((dot) => (
                      <motion.div
                        key={dot}
                        className="w-1 h-1 rounded-full bg-orange-500"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{
                          duration: 1,
                          delay: dot * 0.2,
                          repeat: Infinity,
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Footer note ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-slate-400 dark:text-slate-600 mt-5"
      >
        Deep legal analysis may take up to 60 seconds for complex documents.
      </motion.p>
    </motion.div>
  );
}
