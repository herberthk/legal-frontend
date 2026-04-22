import { FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export type PostCallStage =
  | "encoding"
  | "billing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type Props = {
  stage: PostCallStage;
  encodingProgress: number;
  uploadProgress: number;
  error?: string;
};

const STAGES: { id: PostCallStage; label: string; desc: string }[] = [
  {
    id: "encoding",
    label: "Encoding Audio",
    desc: "Processing your conversation",
  },
  {
    id: "billing",
    label: "Finalizing Session",
    desc: "Summarizing and generating notes",
  },
  { id: "uploading", label: "Uploading", desc: "Saving recording securely" },
  { id: "saving", label: "Updating Record", desc: "Syncing your database" },
  { id: "done", label: "Complete", desc: "Your session is ready!" },
];

const PostCallProgress: FC<Props> = ({
  stage,
  encodingProgress,
  uploadProgress,
  error,
}) => {
  const currentStageIndex = STAGES.findIndex((s) => s.id === stage);
  const isError = stage === "error";

  // Calculate overall progress (simplified for visual representation)
  let overallProgress = 0;
  if (isError) {
    overallProgress = 100;
  } else if (stage === "done") {
    overallProgress = 100;
  } else {
    const baseProgress = (currentStageIndex / (STAGES.length - 1)) * 100;
    let stageProgress = 0;
    if (stage === "encoding") stageProgress = encodingProgress;
    else if (stage === "uploading") stageProgress = uploadProgress;
    else if (stage === "billing" || stage === "saving") stageProgress = 50; // Indeterminate

    overallProgress = Math.min(
      100,
      baseProgress + stageProgress / (STAGES.length - 1),
    );
  }

  return (
    <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex flex-col gap-6 bg-white/10 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/20 dark:border-slate-700/50 rounded-[2rem] p-8 shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-1 relative z-10">
          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-slate-300">
            {isError ? "Session Error" : "Wrapping Up Session"}
          </h3>
          <p className="text-sm text-slate-400">
            {isError
              ? error || "An unexpected error occurred."
              : "Please wait while we finalize your recording."}
          </p>
        </div>

        {/* Progress Ring */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center z-10">
          {!isError && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-white/5 dark:text-slate-800"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="url(#postCallGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - overallProgress / 100)}`}
                style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
              />
              <defs>
                <linearGradient
                  id="postCallGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          )}

          {/* Center Icon/Text */}
          <AnimatePresence mode="wait">
            {isError ? (
              <motion.div
                key="error"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-red-500"
              >
                <AlertCircle size={48} />
              </motion.div>
            ) : stage === "done" ? (
              <motion.div
                key="done"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-emerald-400"
              >
                <CheckCircle2 size={48} />
              </motion.div>
            ) : (
              <motion.div
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <span className="text-2xl font-bold text-white tabular-nums">
                  {Math.round(overallProgress)}%
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Steps List */}
        <div className="space-y-4 relative z-10">
          {STAGES.filter((s) => s.id !== "done").map((s, index) => {
            const isActive = s.id === stage;
            const isPast = index < currentStageIndex;

            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 transition-opacity duration-300 ${
                  isActive
                    ? "opacity-100"
                    : isPast
                      ? "opacity-50"
                      : "opacity-20"
                }`}
              >
                <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {isPast ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-medium ${isActive ? "text-white" : "text-slate-300"}`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>

                {/* Specific Progress values for active stage */}
                {isActive && s.id === "encoding" && (
                  <span className="ml-auto text-xs font-mono text-indigo-400">
                    {Math.round(encodingProgress)}%
                  </span>
                )}
                {isActive && s.id === "uploading" && (
                  <span className="ml-auto text-xs font-mono text-cyan-400">
                    {Math.round(uploadProgress)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default PostCallProgress;
