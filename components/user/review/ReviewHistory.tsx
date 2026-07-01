"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Search,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  MoreVertical,
  Edit2,
  Share2,
  Download,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { getDocumentReviews, deleteDocumentReview, updateDocumentReview } from "@/lib/actions/review";
import { downloadReviewPdf } from "./ReviewPdfExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CustomButton } from "@/components/ui/custom-button";
import { ReviewHistorySkeleton } from "./ReviewHistorySkeleton";
import { storage } from "@/firebase/client";
import { ref, deleteObject } from "firebase/storage";
import BackButton from "@/components/global/BackButton";

interface ReviewHistoryProps {
  onNewReview: () => void;
  onViewReview: (record: DocumentReview) => void;
}

export const ReviewHistory = ({
  onNewReview,
  onViewReview,
}: ReviewHistoryProps) => {
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteModalRecord, setDeleteModalRecord] = useState<DocumentReview | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchReviews = useCallback(
    async (isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const beforeId =
          isLoadMore && reviews.length > 0
            ? reviews[reviews.length - 1].id
            : undefined;

        const res = await getDocumentReviews(9, beforeId);

        // Client-side filtering since Firestore full-text search requires third-party
        const filteredData = (res.reviews || []).filter((r) =>
          debouncedSearch
            ? r.fileName.toLowerCase().includes(debouncedSearch.toLowerCase())
            : true,
        );

        if (isLoadMore) {
          setReviews((prev) => [...prev, ...filteredData]);
        } else {
          setReviews(filteredData);
        }
        setHasMore(res.hasMore || false);

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
    [debouncedSearch, reviews],
  );

  useEffect(() => {
    fetchReviews(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const executeDelete = async () => {
    if (!deleteModalRecord) return;
    const id = deleteModalRecord.id;
    setDeletingId(id);
    const toastId = toast.loading("Initiating deletion...");

    try {
      toast.loading("Deleting record from database...", { id: toastId });
      const res = await deleteDocumentReview(id);

      if (res.success) {
        if (deleteModalRecord.fileUrl) {
          toast.loading("Cleaning up associated files...", { id: toastId });
          try {
            const storageRef = ref(storage, deleteModalRecord.fileUrl);
            await deleteObject(storageRef);
          } catch (storageErr) {
            console.error("Storage cleanup failed:", storageErr);
          }
        }

        setReviews((prev) => prev.filter((r) => r.id !== id));
        toast.success("Review deleted successfully", {
          id: toastId,
          style: { backgroundColor: "#22c55e", color: "white" },
        });
      } else {
        toast.error("Failed to delete review", {
          id: toastId,
          description: res.error,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("An error occurred during deletion", {
        id: toastId,
        description: err.message,
      });
    } finally {
      setDeletingId(null);
      setDeleteModalRecord(null);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const generateAndDownloadReport = async (record: DocumentReview) => {
    setDownloadingId(record.id);
    const toastId = toast.loading("Generating PDF report...");
    try {
      await downloadReviewPdf(record);
      toast.success("PDF downloaded successfully", { id: toastId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Failed to generate PDF", { id: toastId, description: err.message });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = (record: DocumentReview) => {
    toast.info("Sharing functionality will be implemented soon.");
  };

  const saveEdit = async (record: DocumentReview) => {
    if (!editTitle.trim() || editTitle === record.fileName) {
      setEditingId(null);
      return;
    }
    
    setIsUpdating(true);
    const toastId = toast.loading("Updating title...");
    try {
      const res = await updateDocumentReview(record.id, { fileName: editTitle });
      if (res.success) {
        setReviews(prev => prev.map(r => r.id === record.id ? { ...r, fileName: editTitle } : r));
        toast.success("Title updated", { id: toastId });
      } else {
        toast.error("Failed to update title", { id: toastId, description: res.error });
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("An error occurred", { id: toastId, description: err.message });
    } finally {
      setIsUpdating(false);
      setEditingId(null);
    }
  };

  if (isLoading) {
    return <ReviewHistorySkeleton />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-8 py-8 md:py-16 min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-2">
            {/* <BackButton /> */}
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Review{" "}
              <span className="text-orange-600 dark:text-orange-400">
                History
              </span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl">
            View, search, and manage your past legal document reviews.
          </p>
        </div>
        <CustomButton
          onClick={onNewReview}
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#10b981"
          borderRightWidth="4px"
          borderRightColor="#047857"
          className="bg-white dark:bg-slate-900 shadow-sm"
          leftIcon={<Plus className="w-5 h-5" />}
          hoverEffect="glow"
          title="Create new Review"
        >
          New Review
        </CustomButton>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 relative w-full">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm transition-shadow"
          />
        </div>
      </div>

      <div className="flex-1">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="w-20 h-20 bg-orange-50 dark:bg-orange-950/30 rounded-full flex items-center justify-center mb-6">
              <Scale className="w-10 h-10 text-orange-400 dark:text-orange-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {searchQuery ? "No results found" : "No reviews yet"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              {searchQuery
                ? "Try adjusting your search terms."
                : "Upload your first legal document to see its analysis here."}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewReview}
                className="mt-6 text-orange-600 dark:text-orange-400 font-bold hover:underline"
              >
                Get Started &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {reviews.map((record) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onViewReview(record)}
                  className="group cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-200 dark:hover:border-orange-500/30 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-400">
                        <Scale className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {record.overallScore}/100
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Compliance Score
                        </div>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={deletingId === record.id}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 rounded-xl transition-colors"
                          >
                            {deletingId === record.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <MoreVertical className="w-5 h-5" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 z-50 bg-white dark:bg-slate-900">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => {
                            setEditingId(record.id);
                            setEditTitle(record.fileName);
                          }}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleShare(record)}>
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => generateAndDownloadReport(record)}
                            disabled={downloadingId === record.id}
                          >
                            {downloadingId === record.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            {downloadingId === record.id ? "Generating..." : "Download PDF"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteModalRecord(record)}
                            className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {editingId === record.id ? (
                    <div className="mb-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(record);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-transparent border-b border-orange-400 focus:outline-none text-lg font-bold text-slate-900 dark:text-white pb-1"
                      />
                      <button 
                        onClick={() => saveEdit(record)}
                        disabled={isUpdating}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
                      >
                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        disabled={isUpdating}
                        className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="md:text-lg text-base font-bold text-slate-900 dark:text-white mb-1 line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {record.fileName || "Untitled Document"}
                    </h3>
                  )}

                  <p className="md:text-sm text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 line-clamp-1">
                    {record.documentType}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6 mt-auto">
                    {record.risks.filter((r) => r.severity === "HIGH").length >
                      0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        {
                          record.risks.filter((r) => r.severity === "HIGH")
                            .length
                        }{" "}
                        High Risks
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      {record.pageCount} Pages
                    </span>
                    {record.tokensUsed !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold">
                        {record.tokensUsed.toLocaleString()} Tokens
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(record.createdAt)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && !searchQuery && (
          <div className="mt-12 flex justify-center">
            <button
              onClick={() => fetchReviews(true)}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 font-bold rounded-xl border border-orange-100 dark:border-orange-900/50 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors shadow-sm disabled:opacity-50"
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

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModalRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-6">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Delete Review?
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Are you sure you want to delete the review for <strong>{deleteModalRecord.fileName}</strong>? This action cannot be undone and will permanently remove the review and associated files.
              </p>
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => setDeleteModalRecord(null)}
                  disabled={deletingId !== null}
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  disabled={deletingId !== null}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-sm shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingId !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
