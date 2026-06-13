"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/client";
import { saveDocumentReview } from "@/lib/actions/review";
import {
  BUCKETS,
  MAX_REVIEW_FILE_SIZE,
  MAX_REVIEW_FILE_SIZE_MB,
} from "@/constants";

// Simulated stage durations (ms) — will jump to complete when API responds
const STAGE_DURATIONS: Record<ReviewStage, number> = {
  idle: 0,
  uploading: 1500,
  extracting: 2500,
  analyzing: 8000,
  scoring: 4000,
  generating: 3000,
  complete: 0,
  error: 0,
};

const STAGE_ORDER: ReviewStage[] = [
  "uploading",
  "extracting",
  "analyzing",
  "scoring",
  "generating",
  "complete",
];

export function useDocumentReview() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ReviewStage>("idle");
  const [review, setReview] = useState<Omit<
    DocumentReview,
    "id" | "userId" | "fileUrl" | "createdAt" | "updatedAt"
  > | null>(null);
  const [savedReview, setSavedReview] = useState<DocumentReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Track stage advancement timer
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageIndexRef = useRef(0);
  const apiDoneRef = useRef(false);
  const reviewResultRef = useRef<typeof review>(null);

  const clearStageTimer = () => {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  // Advance to the next stage in the pipeline
  const advanceStage = useCallback((targetIndex: number) => {
    if (targetIndex >= STAGE_ORDER.length) return;
    const nextStage = STAGE_ORDER[targetIndex];
    stageIndexRef.current = targetIndex;
    setStage(nextStage);

    // Update progress percentage
    const progressPct = Math.round(
      ((targetIndex + 1) / STAGE_ORDER.length) * 100,
    );
    setProgress(progressPct);

    if (nextStage === "complete") return;

    // If API is already done and we're about to start the last real stage, jump to complete
    if (apiDoneRef.current && targetIndex >= STAGE_ORDER.length - 2) {
      stageTimerRef.current = setTimeout(() => {
        setStage("complete");
        setProgress(100);
        if (reviewResultRef.current) setReview(reviewResultRef.current);
      }, 600);
      return;
    }

    // Otherwise schedule the next stage
    const duration = STAGE_DURATIONS[nextStage];
    stageTimerRef.current = setTimeout(() => {
      advanceStage(targetIndex + 1);
    }, duration);
  }, []);

  // ─── Handle file drop ────────────────────────────────────────────────────────
  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const dropped = acceptedFiles[0];
    if (!dropped) return;

    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isAllowed =
      dropped.type === "application/pdf" ||
      dropped.type === DOCX_MIME ||
      dropped.type.startsWith("image/");
    if (!isAllowed) {
      setError("Only PDF, DOCX, or image files (PNG, JPG, WEBP) are accepted.");
      return;
    }
    if (dropped.size > MAX_REVIEW_FILE_SIZE) {
      setError(
        `File exceeds ${MAX_REVIEW_FILE_SIZE_MB}MB limit. Your file is ${(dropped.size / 1024 / 1024).toFixed(1)}MB.`,
      );
      return;
    }

    setError(null);
    setFile(dropped);
  }, []);

  // ─── Start review ────────────────────────────────────────────────────────────
  const startReview = useCallback(async () => {
    if (!file) return;

    setError(null);
    setReview(null);
    setSavedReview(null);
    apiDoneRef.current = false;
    reviewResultRef.current = null;

    // Begin staged animation
    advanceStage(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/review", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        clearStageTimer();
        setStage("error");
        setError(data.error || "Review failed. Please try again.");
        return;
      }

      // API responded — mark done and store result
      apiDoneRef.current = true;
      reviewResultRef.current = data.review;

      // If animation is already past "analyzing", jump straight to complete
      if (stageIndexRef.current >= STAGE_ORDER.length - 2) {
        clearStageTimer();
        setStage("complete");
        setProgress(100);
        setReview(data.review);
      }
      // Otherwise let the animation finish naturally — it will pick up the result
    } catch {
      clearStageTimer();
      setStage("error");
      setError("Network error. Please check your connection and try again.");
    }
  }, [file, advanceStage]);

  // ─── Save review to Firestore + Firebase Storage ──────────────────────────────
  const saveReview = useCallback(async () => {
    if (!review || !file) return;

    setIsSaving(true);
    const toastId = toast.loading("Uploading document...");

    try {
      // 1. Upload PDF to Firebase Storage
      const storageRef = ref(
        storage,
        `${BUCKETS.STORED_FILES}/reviews/${Date.now()}_${file.name}`,
      );
      const snapshot = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      toast.loading("Saving review...", { id: toastId });

      // 2. Save review record to Firestore
      const result = await saveDocumentReview({
        ...review,
        fileUrl,
      });

      if (result.success && result.id) {
        toast.success("Review saved successfully!", { id: toastId });
        // Build the full saved review object for display
        setSavedReview({
          ...review,
          id: result.id,
          userId: "",
          fileUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        toast.error("Failed to save review.", {
          id: toastId,
          description: result.error,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while saving.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [review, file]);

  // ─── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    clearStageTimer();
    setFile(null);
    setStage("idle");
    setReview(null);
    setSavedReview(null);
    setError(null);
    setProgress(0);
    apiDoneRef.current = false;
    reviewResultRef.current = null;
    stageIndexRef.current = 0;
  }, []);

  return {
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
  };
}
