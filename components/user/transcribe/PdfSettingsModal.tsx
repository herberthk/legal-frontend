import { AnimatePresence, motion } from "framer-motion";
import { X, FileText, Layout, Type, Hash } from "lucide-react";
import { Dispatch, SetStateAction, memo } from "react";

interface PdfSettingsModalProps {
  setShowSettingsModal: Dispatch<SetStateAction<boolean>>;
  documentTitle: string;
  setDocumentTitle: Dispatch<SetStateAction<string>>;
  headerText: string;
  setHeaderText: Dispatch<SetStateAction<string>>;
  footerText: string;
  setFooterText: Dispatch<SetStateAction<string>>;
  showPageNumbers: boolean;
  setShowPageNumbers: Dispatch<SetStateAction<boolean>>;
  pageNumberPosition: string;
  setPageNumberPosition: Dispatch<
    SetStateAction<
      | "bottom-center"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "top-right"
      | "top-left"
    >
  >;
}

export const PdfSettingsModal = memo(
  ({
    setShowSettingsModal,
    documentTitle,
    setDocumentTitle,
    headerText,
    setHeaderText,
    footerText,
    setFooterText,
    showPageNumbers,
    setShowPageNumbers,
    pageNumberPosition,
    setPageNumberPosition,
  }: PdfSettingsModalProps) => {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-indigo-500/10 dark:border-indigo-400/10"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-indigo-500/10 dark:border-indigo-400/10 flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-xl">
                  <Layout className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  PDF Layout Settings
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Document Title */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Document Title (Filename)
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="e.g., Legal Report 2024"
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border border-indigo-500/10 dark:border-indigo-400/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              {/* Custom Header */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Type className="w-4 h-4 text-indigo-500" />
                  Custom Header Text
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="e.g., Confidential - Internal Use Only"
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border border-indigo-500/10 dark:border-indigo-400/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
                <p className="text-xs text-slate-500 dark:text-slate-500 ml-1">
                  Optional. Appears at the top of every page.
                </p>
              </div>

              {/* Custom Footer */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  <Type className="w-4 h-4 text-indigo-500" />
                  Custom Footer Text
                </label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="e.g., Generated by Scribe AI"
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border border-indigo-500/10 dark:border-indigo-400/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              {/* Page Numbers Section */}
              <div className="pt-4 border-t border-indigo-500/10 dark:border-indigo-400/10">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showPageNumbers}
                        onChange={(e) => setShowPageNumbers(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-12 h-6 rounded-full transition-colors duration-300 ${showPageNumbers ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}
                      ></div>
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${showPageNumbers ? "translate-x-6" : "translate-x-0"}`}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      Show Page Numbers
                    </span>
                  </label>
                </div>

                <AnimatePresence>
                  {showPageNumbers && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <Hash className="w-4 h-4 text-indigo-500" />
                        Position
                      </label>
                      <select
                        value={pageNumberPosition}
                        onChange={(e) =>
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setPageNumberPosition(e.target.value as any)
                        }
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border border-indigo-500/10 dark:border-indigo-400/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-900 dark:text-white appearance-none cursor-pointer"
                      >
                        <option value="bottom-center">Bottom Center</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-indigo-500/10 dark:border-indigo-400/10 bg-indigo-50/30 dark:bg-indigo-950/30 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                Apply Changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  },
);

PdfSettingsModal.displayName = "PdfSettingsModal";
