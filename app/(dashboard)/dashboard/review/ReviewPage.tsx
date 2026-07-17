"use client";

import { AnimatePresence } from "framer-motion";
import { useDocumentReview } from "@/hooks/use-document-review";
import { ReviewUploadZone } from "@/components/user/review/ReviewUploadZone";
import { ReviewProcessing } from "@/components/user/review/ReviewProcessing";
import { ReviewResults } from "@/components/user/review/ReviewResults";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";

const PROCESSING_STAGES: ReviewStage[] = [
  "uploading",
  "extracting",
  "analyzing",
  "scoring",
  "generating",
];

export default function ReviewPage() {
  const {
    file,
    stage,
    review,
    savedReview,
    error,
    progress,
    isSaving,
    handleDrop,
    startReview,
    saveReview,
    reset,
  } = useDocumentReview();

  const isProcessing = PROCESSING_STAGES.includes(stage);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <main className="w-full max-w-5xl mx-auto px-2 md:px-8 py-6 md:py-14">
        <AnimatePresence mode="wait">
          {/* ── Idle / upload stage ─────────────────────── */}
          {(stage === "idle" || (stage === "uploading" && !isProcessing)) && (
            <div key="upload">
              <ReviewUploadZone
                onDrop={handleDrop}
                error={error}
                file={file}
                onStart={startReview}
              />
            </div>
          )}

          {/* ── Upload with file selected (pre-submit) ─── */}
          {stage === "idle" && file && (
            <div key="upload-ready" />
          )}

          {/* ── Processing stages ─────────────────────── */}
          {isProcessing && (
            <div key="processing" className="flex items-center justify-center min-h-[70vh]">
              <div className="w-full max-w-2xl">
                <ReviewProcessing
                  stage={stage}
                  progress={progress}
                  fileName={file?.name}
                />
              </div>
            </div>
          )}

          {/* ── Error state ───────────────────────────── */}
          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                  Review Failed
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {error || "An unexpected error occurred. Please try again."}
                </p>
              </div>
             
               <CustomButton
                  onClick={reset}
                  variant="transparent"
                  shape="pill"
                  borderLeftWidth="4px"
                  borderLeftColor="#4f46e5"
                  borderRightWidth="4px"
                  borderRightColor="#ea580c"
                  className="bg-slate-100/50 dark:bg-slate-800/50"
                  rightIcon={<RefreshCw size={16} />}
                  hoverEffect="glow"
              >
                  Try Again
              </CustomButton>
            </motion.div>
          )}

          {/* ── Complete — show results ────────────────── */}
          {stage === "complete" && review && (
            <div key="results">
              <ReviewResults
                review={review}
                isSaving={isSaving}
                isSaved={!!savedReview}
                onSave={saveReview}
                onReset={reset}
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
