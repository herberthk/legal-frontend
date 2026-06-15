import { motion } from "framer-motion";
import {
  Edit3,
  FileText,
  Download,
  Settings,
  RotateCcw,
  Save,
  Loader2,
  MoreVertical,
  FileImage,
  FileOutput,
} from "lucide-react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { TranscribeStatus } from "@/hooks/use-document-transcribe";
import { memo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface EditorViewProps {
  status: TranscribeStatus;
  setStatus: (status: TranscribeStatus) => void;
  transcription: string;
  setTranscription: (text: string) => void;
  previewUrl: string | null;
  file: File | null;
  onShowReference: () => void;
  onDownload: () => void;
  onReset: () => void;
  onExportDoc: () => void;
  setShowSettingsModal: (show: boolean) => void;
  onSave?: () => void;
  isSaving?: boolean;
  isUpdating?: boolean;
}

export const EditorView = memo(
  ({
    status,
    setStatus,
    transcription,
    setTranscription,
    onShowReference,
    onDownload,
    onReset,
    onExportDoc,
    setShowSettingsModal,
    onSave,
    isSaving,
    isUpdating,
  }: EditorViewProps) => {
    return (
      <motion.div
        key="editor"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        className="flex flex-col h-full min-h-[85vh] w-full max-w-[1500px] mx-auto"
      >
        {/* ── Header Row ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-8 px-2">

          {/* Left: Tab switcher */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl p-2 border border-indigo-500/10 dark:border-indigo-400/10 shadow-xl shadow-indigo-500/5 shrink-0">
            <button
              onClick={() => setStatus("editing")}
              className={`flex items-center gap-2 px-3 md:px-6 py-1.5 md:py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                status === "editing"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Transcription</span>
              <span className="sm:hidden">Edit</span>
            </button>
            <button
              onClick={() => setStatus("previewing")}
              className={`flex items-center gap-2 px-3 md:px-6 py-1.5 md:py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                status === "previewing"
                  ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Final Preview</span>
              <span className="sm:hidden">Preview</span>
            </button>
          </div>

          {/* Right: Save button + Menu */}
          <div className="flex items-center gap-3">
            {/* Save / Update — always visible */}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-95 border-b-4 border-indigo-800 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isSaving ? "Saving..." : isUpdating ? "Update Changes" : "Save"}
                </span>
              </button>
            )}

            {/* ⋮ Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 shadow-sm"
                  title="More options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-1.5"
              >
                <DropdownMenuLabel className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1.5">
                  Options
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={onShowReference}
                  className="cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <FileImage className="w-4 h-4 text-orange-500 shrink-0" />
                  View Original
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setShowSettingsModal(true)}
                  className="cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-500 shrink-0" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />

                <DropdownMenuLabel className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1.5">
                  Export
                </DropdownMenuLabel>

                <DropdownMenuItem
                  onClick={onDownload}
                  className="cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                >
                  <Download className="w-4 h-4 text-orange-500 shrink-0" />
                  Export to PDF
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onExportDoc}
                  className="cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                >
                  <FileOutput className="w-4 h-4 text-indigo-500 shrink-0" />
                  Export as Doc
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />

                <DropdownMenuItem
                  onClick={onReset}
                  className="cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  Start Over
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Editor / Preview ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl md:rounded-[2.5rem] shadow-2xl border border-indigo-500/10 dark:border-indigo-400/10 flex-1 overflow-hidden flex flex-col transition-all duration-500">
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-950/10 p-2 md:p-8 overflow-y-auto custom-scrollbar items-center">
            <div className="w-full max-w-5xl h-full flex flex-col">
              <TiptapEditor
                content={transcription}
                onChange={setTranscription}
                readOnly={status === "previewing"}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  },
);

EditorView.displayName = "EditorView";
