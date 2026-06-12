import { memo } from "react";
import { FileText } from "lucide-react";

interface TranscriptionEmptyStateProps {
  searchQuery: string;
  timeRange: string;
  onNewTranscription: () => void;
}

export const TranscriptionEmptyState = memo(({
  searchQuery,
  timeRange,
  onNewTranscription,
}: TranscriptionEmptyStateProps) => {
  return (
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
  );
});

TranscriptionEmptyState.displayName = "TranscriptionEmptyState";
