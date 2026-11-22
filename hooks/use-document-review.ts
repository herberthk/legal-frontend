"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/client";
import { saveDocumentReview } from "@/lib/actions/review";
import { getAppCheckToken } from "@/lib/firebaseAppCheck";
import posthog from "posthog-js";
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
  const [review, setReview] = useState<Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt"> | null>(null);
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

    if (nextStage === "complete") {
      // Do not transition to complete unless API has actually returned review data
      if (apiDoneRef.current && reviewResultRef.current) {
        setStage("complete");
        setProgress(100);
        setReview(reviewResultRef.current);
      } else {
        // Hold on the last processing stage ("generating") with 95% progress until API responds
        stageIndexRef.current = STAGE_ORDER.length - 2;
        setStage("generating");
        setProgress(95);
      }
      return;
    }

    stageIndexRef.current = targetIndex;
    setStage(nextStage);

    // Update progress percentage
    const progressPct = Math.round(
      ((targetIndex + 1) / STAGE_ORDER.length) * 100,
    );
    setProgress(Math.min(progressPct, 95));

    // If API is already done, immediately jump to complete
    if (apiDoneRef.current && reviewResultRef.current) {
      clearStageTimer();
      setStage("complete");
      setProgress(100);
      setReview(reviewResultRef.current);
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

    const controller = new AbortController();
    // 120-second timeout matching maxDuration on the route
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const appCheckToken = await getAppCheckToken();
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          ...(appCheckToken ? { "x-firebase-appcheck": appCheckToken } : {}),
        },
        body: formData,
        signal: controller.signal,
      });

      // Safely parse JSON without throwing if the server or proxy returned an HTML/text error page (e.g. 504/502/413)
      let data: {
        success?: boolean;
        review?: Omit<DocumentReview, "id" | "userId" | "fileUrl" | "updatedAt">;
        error?: string;
      } | null = null;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data?.success) {
        clearStageTimer();
        setStage("error");

        if (response.status === 504) {
          setError(
            "The review timed out because the document is long or complex. Please try again with a shorter document or fewer pages."
          );
          return;
        }

        if (response.status === 413) {
          setError(
            "The document file size is too large for processing. Please compress the file and try again."
          );
          return;
        }

        if (response.status === 429) {
          setError(
            "The AI review service is currently experiencing high demand. Please wait a moment and try again."
          );
          return;
        }

        if (response.status === 402) {
          setError(
            data?.error ||
              "Insufficient funds or tokens to review this document. Please check your credit balance."
          );
          return;
        }

        if (response.status === 401) {
          setError(
            data?.error ||
              "Your session or App Check verification expired. Please refresh the page and sign in again."
          );
          return;
        }

        if (response.status === 422) {
          setError(
            data?.error ||
              "The document content could not be processed or is unreadable. Please check the file."
          );
          return;
        }

        if (data?.error) {
          setError(data.error);
          return;
        }

        setError(
          `Review request failed (${response.status} ${response.statusText || "Server Error"}). Please try again.`
        );
        return;
      }

      if (!data?.review) {
        clearStageTimer();
        setStage("error");
        setError(
          data?.error || "Review completed, but no review details were returned. Please try again."
        );
        return;
      }

      // API responded — mark done and store result
      apiDoneRef.current = true;
      reviewResultRef.current = data.review;

      // Immediately clear timers, set stage to complete, and display review results
      clearStageTimer();
      setStage("complete");
      setProgress(100);
      setReview(data.review);
      posthog.capture("document_review_completed", {
        document_type: file.type === "application/pdf" ? "pdf" : file.type.startsWith("image/") ? "image" : "docx",
      });
    } catch (err: unknown) {
      clearStageTimer();
      setStage("error");

      if (err instanceof Error && err.name === "AbortError") {
        setError(
          "Document review timed out after 2 minutes. The document may be too large or complex. Please try with a smaller file."
        );
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError(
          "You appear to be offline. Please check your internet connection and try again."
        );
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      console.error("[useDocumentReview] Review error:", err);
      setError(
        `Review process interrupted (${message || "Connection terminated by server"}). Please try again.`
      );
    } finally {
      clearTimeout(timeoutId);
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
        posthog.capture("document_review_saved");
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
