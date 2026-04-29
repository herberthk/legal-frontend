"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileText, 
  Search, 
  Trash2, 
  Plus, 
  Clock, 
  MoreVertical, 
  Loader2, 
  Calendar,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getTranscriptions, deleteTranscriptionRecord } from "@/lib/actions/transcribe";

interface TranscriptionHistoryProps {
  onNewTranscription: () => void;
  onViewTranscription: (record: TranscriptionRecord) => void;
}

export const TranscriptionHistory = ({
  onNewTranscription,
  onViewTranscription,
}: TranscriptionHistoryProps) => {
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTranscriptions = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const beforeId = isLoadMore && transcriptions.length > 0
        ? transcriptions[transcriptions.length - 1].id
        : undefined;

      const res = await getTranscriptions(10, beforeId, debouncedSearch);

      if (res.success) {
        if (isLoadMore) {
          setTranscriptions((prev) => [...prev, ...(res.transcriptions || [])]);
        } else {
          setTranscriptions(res.transcriptions || []);
        }
        setHasMore(res.hasMore || false);
      } else {
        toast.error("Failed to load transcriptions", { description: res.error });
      }
    } catch (error) {
      toast.error("An error occurred while loading history.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedSearch, transcriptions.length]);

  useEffect(() => {
    fetchTranscriptions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    const res = await deleteTranscriptionRecord(id);
    if (res.success) {
      setTranscriptions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transcription deleted successfully");
    } else {
      toast.error("Failed to delete transcription", { description: res.error });
    }
    setDeletingId(null);
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 min-h-screen flex flex-col bg-indigo-50/5 dark:bg-slate-900 transition-colors duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
            Transcription <span className="text-indigo-600 dark:text-indigo-400">History</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
            View, search, and manage your past document transcriptions.
          </p>
        </div>
        <button
          onClick={onNewTranscription}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/30 transition-all duration-300 active:scale-95 border-b-4 border-indigo-800"
        >
          <Plus className="w-5 h-5" />
          New Transcription
        </button>
      </div>

      <div className="flex items-center relative mb-8">
        <Search className="w-5 h-5 text-slate-400 absolute left-4" />
        <input
          type="text"
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-shadow"
        />
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
              Loading your history...
            </p>
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center bg-white dark:bg-slate-800 rounded-3xl border border-indigo-50 dark:border-slate-700 p-8 shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-indigo-300 dark:text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {searchQuery ? "No results found" : "No transcriptions yet"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              {searchQuery
                ? "Try adjusting your search terms."
                : "Create your first transcription to see it appear here."}
            </p>
            {!searchQuery && (
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
                      onClick={(e) => handleDelete(record.id, e)}
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
                    {record.transcribedText.slice(0, 150)}...
                  </p>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(record.createdAt)}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-600 dark:text-slate-300">
                      {record.formatMode === "professional" ? "Pro" : "Original"}
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
