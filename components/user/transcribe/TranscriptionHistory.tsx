"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getTranscriptions,
  deleteTranscriptionRecord,
  saveTranscriptionRecord,
} from "@/lib/actions/transcribe";
import { CustomButton } from "@/components/ui/custom-button";
import { HistorySkeleton } from "./TranscriptionSkeleton";
import { storage } from "@/firebase/client";
import { ref, deleteObject } from "firebase/storage";
import { TranscriptionFilters } from "./TranscriptionFilters";
import { TranscriptionEmptyState } from "./TranscriptionEmptyState";
import { TranscriptionCard } from "./TranscriptionCard";
import DeleteModal from "./Delete";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument } from "@/components/editor/PDFDocument";

interface TranscriptionHistoryProps {
  onNewTranscription: () => void;
  onViewTranscription: (record: TranscriptionRecord) => void;
}

type TimeRange = "all" | "24h" | "7d" | "30d";

export const TranscriptionHistory = ({
  onNewTranscription,
  onViewTranscription,
}: TranscriptionHistoryProps) => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<TranscriptionRecord | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTranscriptions = useCallback(
    async (isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const beforeId =
          isLoadMore && transcriptions.length > 0
            ? transcriptions[transcriptions.length - 1].id
            : undefined;

        const res = await getTranscriptions(
          10,
          beforeId,
          debouncedSearch,
          timeRange,
        );

        if (res.success) {
          if (isLoadMore) {
            setTranscriptions((prev) => [
              ...prev,
              ...(res.transcriptions || []),
            ]);
          } else {
            setTranscriptions(res.transcriptions || []);
          }
          setHasMore(res.hasMore || false);
        } else {
          toast.error("Failed to load transcriptions", {
            description: res.error,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        toast.error("An error occurred while loading history.", {
          description: error.message,
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedSearch, timeRange, transcriptions],
  );

  useEffect(() => {
    fetchTranscriptions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, timeRange]);

  const confirmDelete = useCallback((record: TranscriptionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecordToDelete(record);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!recordToDelete) return;
    const id = recordToDelete.id;
    setDeletingId(id);
    const toastId = toast.loading("Initiating deletion...");

    try {
      // Stage 1: Record deletion
      toast.loading("Deleting record from database...", { id: toastId });
      const res = await deleteTranscriptionRecord(id);

      if (res.success) {
        // Stage 2: Storage cleanup
        if (res.fileUrl) {
          toast.loading("Cleaning up associated files...", { id: toastId });
          try {
            const storageRef = ref(storage, res.fileUrl);
            await deleteObject(storageRef);
          } catch (storageErr) {
            console.error("Storage cleanup failed:", storageErr);
            // We don't fail the whole operation if storage cleanup fails
          }
        }

        setTranscriptions((prev) => prev.filter((t) => t.id !== id));
        toast.success("Transcription and files deleted successfully", {
          id: toastId,
          style: {
            backgroundColor: "#22c55e",
            color: "white",
          },
        });
      } else {
        toast.error("Failed to delete transcription", {
          id: toastId,
          description: res.error,
          style: {
            backgroundColor: "#dc2626",
            color: "white",
          },
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("An error occurred during deletion", {
        id: toastId,
        description: err.message,
        style: {
          backgroundColor: "#dc2626",
          color: "white",
        },
      });
    } finally {
      setDeletingId(null);
      setRecordToDelete(null);
    }
  }, [recordToDelete, transcriptions]);

  const handleSaveTitle = useCallback(async (record: TranscriptionRecord, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (!editingTitleValue.trim() || editingTitleValue === record.title) {
      setEditingTitleId(null);
      return;
    }

    const toastId = toast.loading("Saving new title...");
    try {
      const res = await saveTranscriptionRecord({
        id: record.id,
        title: editingTitleValue,
        fileName: record.fileName,
        fileUrl: record.fileUrl,
        transcribedText: record.transcribedText,
        formatMode: record.formatMode,
        tokensUsed: record.tokensUsed,
      });

      if (res.success) {
        setTranscriptions((prev) =>
          prev.map((t) => (t.id === record.id ? { ...t, title: editingTitleValue } : t))
        );
        toast.success("Title updated", { id: toastId });
      } else {
        toast.error("Failed to update title", { id: toastId, description: res.error });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Error saving title", { id: toastId, description: err.message });
    } finally {
      setEditingTitleId(null);
    }
  }, [editingTitleValue, transcriptions]);

  const handleDownload = useCallback(async (record: TranscriptionRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const toastId = toast.loading("Generating PDF...");
    try {
      const blob = await pdf(
        <PDFDocument
          content={record.transcribedText}
          filename={record.title || record.fileName || "document"}
          showPageNumbers={true}
          pageNumberPosition="bottom-center"
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = (record.title || record.fileName || "document")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      link.download = `scribe-${safeTitle}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully!", { id: toastId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- PDF Generation Error ---", err);
      toast.error(
        `Failed to generate PDF: ${err?.message || "Unknown rendering error"}`,
        { id: toastId }
      );
    }
  }, []);

  if (isLoading) {
    return <HistorySkeleton />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 min-h-screen flex flex-col bg-indigo-50/5 dark:bg-slate-900 transition-colors duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
            Transcription{" "}
            <span className="text-indigo-600 dark:text-indigo-400">
              History
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
            View, search, and manage your past document transcriptions.
          </p>
        </div>
        <CustomButton
          onClick={onNewTranscription}
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50"
          leftIcon={<Plus className="w-5 h-5" />}
          hoverEffect="glow"
          title="Create new Transcription"
        >
          New Transcription
        </CustomButton>
      </div>

      <TranscriptionFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
      />

      <div className="flex-1">
        {transcriptions.length === 0 ? (
          <TranscriptionEmptyState
            searchQuery={searchQuery}
            timeRange={timeRange}
            onNewTranscription={onNewTranscription}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {transcriptions.map((record) => (
                <TranscriptionCard
                  key={record.id}
                  record={record}
                  onView={onViewTranscription}
                  onDeleteRequest={confirmDelete}
                  deletingId={deletingId}
                  editingTitleId={editingTitleId}
                  editingTitleValue={editingTitleValue}
                  setEditingTitleId={setEditingTitleId}
                  setEditingTitleValue={setEditingTitleValue}
                  onSaveTitle={handleSaveTitle}
                  onDownload={handleDownload}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => fetchTranscriptions(true)}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl border border-indigo-100 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </button>
          </div>
        )}
      </div>

      <DeleteModal
        recordToDelete={recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onDelete={handleDelete}
        isDeleting={deletingId === recordToDelete?.id}
      />
    </div>
  );
};
