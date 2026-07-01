"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, CheckCircle2, MoreVertical, FilePlus, FileDown } from "lucide-react";
import { ReviewScoreGauge } from "./ReviewScoreGauge";
import { ReviewRadarChart } from "./ReviewRadarChart";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewClauses } from "./ReviewClauses";
import { ReviewRisks } from "./ReviewRisks";
import { ReviewRecommendations } from "./ReviewRecommendations";
import { downloadReviewPdf } from "./ReviewPdfExport";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleExportPdf = useCallback(async () => {
    setMenuOpen(false);
    await downloadReviewPdf(review);
  }, [review]);

  const handleNewReview = useCallback(() => {
    setMenuOpen(false);
    onReset();
  }, [onReset]);

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
          <h2 className="md:text-xl text-lg font-bold text-slate-900 dark:text-slate-50">
            Review Complete
          </h2>
          <p className="md:text-sm text-xs text-slate-500 dark:text-slate-400">
            {review.fileName} · {review.documentType}
          </p>
        </div>
        <div className="flex gap-4">
          {/* Save / Saved button */}
          {isSaved ? (
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-orange-700 dark:text-orange-300 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved</span>
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

          {/* ── Kebab menu ── */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 active:scale-95"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-12 z-50 min-w-[190px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-slate-900/40 overflow-hidden"
                >
                  <button
                    onClick={handleNewReview}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150"
                  >
                    <FilePlus className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    New Review
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                  <button
                    onClick={handleExportPdf}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-150"
                  >
                    <FileDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Export as PDF
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
