import { memo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  MoreVertical,
  Edit2,
  Share2,
  Download,
  Trash2,
  Loader2,
  Calendar,
  Coins,
  FileOutput,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TranscriptionCardProps {
  record: TranscriptionRecord;
  onView: (record: TranscriptionRecord) => void;
  onDeleteRequest: (record: TranscriptionRecord, e: React.MouseEvent) => void;
  deletingId: string | null;
  editingTitleId: string | null;
  editingTitleValue: string;
  setEditingTitleId: (id: string | null) => void;
  setEditingTitleValue: (value: string) => void;
  onSaveTitle: (
    record: TranscriptionRecord,
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => Promise<void>;
  onDownload: (record: TranscriptionRecord, e: React.MouseEvent) => void;
  onDownloadDoc: (record: TranscriptionRecord, e: React.MouseEvent) => void;
}

export const TranscriptionCard = memo(({
  record,
  onView,
  onDeleteRequest,
  deletingId,
  editingTitleId,
  editingTitleValue,
  setEditingTitleId,
  setEditingTitleValue,
  onSaveTitle,
  onDownload,
  onDownloadDoc,
}: TranscriptionCardProps) => {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onView(record)}
      className="group cursor-pointer bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-300 flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
          <FileText className="w-6 h-6" />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingTitleId(record.id);
                  setEditingTitleValue(record.title || "Untitled Document");
                }}
                className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Title
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => onDownload(record, e as unknown as React.MouseEvent)}
                className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                <Download className="w-4 h-4 mr-2 text-orange-500" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => onDownloadDoc(record, e as unknown as React.MouseEvent)}
                className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                <FileOutput className="w-4 h-4 mr-2 text-indigo-500" />
                Export as Doc
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
              <DropdownMenuItem
                onClick={(e) =>
                  onDeleteRequest(record, e as unknown as React.MouseEvent)
                }
                disabled={deletingId === record.id}
                className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                {deletingId === record.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {editingTitleId === record.id ? (
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={editingTitleValue}
            onChange={(e) => setEditingTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveTitle(record, e);
              if (e.key === "Escape") setEditingTitleId(null);
            }}
            onBlur={(e) => onSaveTitle(record)}
            autoFocus
            className="w-full text-xl font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-indigo-500 focus:outline-none py-1"
          />
        </div>
      ) : (
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {record.title || "Untitled Document"}
        </h3>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1">
        {record.transcribedText.replace(/<[^>]*>?/gm, "").slice(0, 150)}
        ...
      </p>

      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto text-xs font-medium text-slate-400 dark:text-slate-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(record.createdAt)}</span>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full text-slate-600 dark:text-slate-300">
            {record.formatMode === "professional" ? "Pro" : "Original"}
          </span>
        </div>
        {record.tokensUsed ? (
          <div className="flex items-center gap-1.5 text-indigo-500 dark:text-indigo-400">
            <Coins className="w-3.5 h-3.5" />
            <span>{record.tokensUsed.toLocaleString()} tokens</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
});

TranscriptionCard.displayName = "TranscriptionCard";
