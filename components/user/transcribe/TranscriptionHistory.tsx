"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Search, 
  Trash2, 
  Plus, 
  Loader2, 
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTranscriptions,
  deleteTranscriptionRecord,
} from "@/lib/actions/transcribe";
import { CustomButton } from "@/components/ui/custom-button";
import { HistorySkeleton } from "./TranscriptionSkeleton";
import { storage } from "@/firebase/client";
import { ref, deleteObject } from "firebase/storage";

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

  const handleDelete = async (
    record: TranscriptionRecord,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const id = record.id;
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
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <div className="flex-1 relative w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-shadow"
          />
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-auto">
          {(["all", "24h", "7d", "30d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                timeRange === range
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
            >
              {range === "all"
                ? "All Time"
                : range === "24h"
                  ? "Last 24h"
                  : range === "7d"
                    ? "Last 7 Days"
                    : "Last 30 Days"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center bg-white dark:bg-slate-800 rounded-3xl border border-indigo-50 dark:border-slate-700 p-8 shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-indigo-300 dark:text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {searchQuery || timeRange !== "all"
                ? "No results found"
                : "No transcriptions yet"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              {searchQuery || timeRange !== "all"
                ? "Try adjusting your filters or search terms."
                : "Create your first transcription to see it appear here."}
            </p>
            {!searchQuery && timeRange === "all" && (
              <button
                onClick={onNewTranscription}
                className="mt-6 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Get Started &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {transcriptions.map((record) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onViewTranscription(record)}
                  className="group cursor-pointer bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <button
                      onClick={(e) => handleDelete(record, e)}
                      disabled={deletingId === record.id}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      {deletingId === record.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {record.title || "Untitled Document"}
                  </h3>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1">
                    {record.transcribedText
                      .replace(/<[^>]*>?/gm, "")
                      .slice(0, 150)}
                    ...
                  </p>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(record.createdAt)}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-600 dark:text-slate-300">
                      {record.formatMode === "professional"
                        ? "Pro"
                        : "Original"}
                    </span>
                  </div>
                </motion.div>
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
    </div>
  );
};
