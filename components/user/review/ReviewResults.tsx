"use client";

import { motion } from "framer-motion";
import { Save, RotateCcw, CheckCircle2 } from "lucide-react";
import { ReviewScoreGauge } from "./ReviewScoreGauge";
import { ReviewRadarChart } from "./ReviewRadarChart";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewClauses } from "./ReviewClauses";
import { ReviewRisks } from "./ReviewRisks";
import { ReviewRecommendations } from "./ReviewRecommendations";
import { ReviewPdfExport } from "./ReviewPdfExport";

interface ReviewResultsProps {
  review: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt">;
  isSaving: boolean;
  isSaved: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function ReviewResults({
  review,
  isSaving,
  isSaved,
  onSave,
  onReset,
}: ReviewResultsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* ── Action bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Review Complete
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {review.fileName} · {review.documentType}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ReviewPdfExport review={review} />

          {isSaved ? (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-sm font-semibold border border-orange-200 dark:border-orange-800">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </div>
          ) : (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 active:scale-95"
            >
              {isSaving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Save className="w-4 h-4" />
                </motion.div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? "Saving..." : "Save Review"}
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            New Review
          </button>
        </div>
      </div>

      {/* ── Score row (gauge + radar) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReviewScoreGauge score={review.overallScore} />
        <ReviewRadarChart data={review.scoreBreakdown} />
      </div>

      {/* ── Summary & highlights ──────────────────────────── */}
      <ReviewSummary
        documentType={review.documentType}
        summary={review.summary}
        highlights={review.highlights}
        fileName={review.fileName}
        pageCount={review.pageCount}
        tokensUsed={review.tokensUsed}
      />

      {/* ── Risks ────────────────────────────────────────── */}
      <div className="md:p-5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
        <ReviewRisks risks={review.risks} />
      </div>

      {/* ── Key Clauses ──────────────────────────────────── */}
      <div className="md:p-5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
        <ReviewClauses clauses={review.keyClauses} />
      </div>

      {/* ── Recommendations ──────────────────────────────── */}
      <div className="md:p-5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
        <ReviewRecommendations recommendations={review.recommendations} />
      </div>

      {/* ── Bottom disclaimer ─────────────────────────────── */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-8">
        AI-assisted analysis grounded in Ugandan law. This does not constitute formal legal advice.
        Consult a qualified advocate before taking legal action.
      </p>
    </motion.div>
  );
}
