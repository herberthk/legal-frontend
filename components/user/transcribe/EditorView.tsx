import { motion } from "framer-motion";
import { Edit3, FileText, FileImage, Download, Settings, RotateCcw, Save, Loader2 } from "lucide-react";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { TranscribeStatus } from "@/hooks/use-document-transcribe";
import { memo } from "react";

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
  setShowSettingsModal: (show: boolean) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const EditorView = memo(({
  status,
  setStatus,
  transcription,
  setTranscription,
  onShowReference,
  onDownload,
  onReset,
  setShowSettingsModal,
  onSave,
  isSaving,
}: EditorViewProps) => {
  return (
    <motion.div
      key="editor"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="flex flex-col h-full min-h-[85vh] w-full max-w-[1500px] mx-auto"
    >
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-8 px-2">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl p-2 border border-indigo-500/10 dark:border-indigo-400/10 shadow-xl shadow-indigo-500/5">
          <button
            onClick={() => setStatus("editing")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${status === "editing" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"}`}
          >
            <Edit3 className="w-4 h-4" />
            Edit Transcription
          </button>
          <button
            onClick={() => setStatus("previewing")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${status === "previewing" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"}`}
          >
            <FileText className="w-4 h-4" />
            Final Preview
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Start Over Button - Professional and sleek */}
          <button
            onClick={onReset}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all duration-300 shadow-sm border-b-4 active:border-b-0 active:translate-y-1"
          >
            <RotateCcw className="w-4 h-4" />
            Start Over
          </button>

          {/* Original Document Button - Always available in both Edit and Preview */}
          <button
            onClick={onShowReference}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-all duration-300 shadow-sm border-b-4 active:border-b-0 active:translate-y-1"
          >
            <FileImage className="w-4 h-4 text-orange-500" />
            View Original
          </button>

          {status === "previewing" && (
            <>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 shadow-sm border-b-4 active:border-b-0 active:translate-y-1"
                title="PDF Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              
              <button
                onClick={onDownload}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-orange-600 text-white font-black hover:bg-orange-700 transition-all duration-300 shadow-lg shadow-orange-500/20 active:scale-95 active:translate-y-1 border-b-4 border-orange-800"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>

              {onSave && (
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-95 active:translate-y-1 border-b-4 border-indigo-800 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? "Saving..." : "Save to DB"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-indigo-500/10 dark:border-indigo-400/10 flex-1 overflow-hidden flex flex-col transition-all duration-500">
        {/* Editor or Preview Container - Now always full width */}
        <div
          className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-950/10 p-4 md:p-8 overflow-y-auto custom-scrollbar items-center"
        >
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
});

EditorView.displayName = "EditorView";
