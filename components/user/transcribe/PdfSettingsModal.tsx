import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

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

export const PdfSettingsModal = ({
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-[#1a1a1a]/10"
        >
          <div className="p-6 border-b border-[#1a1a1a]/10 flex items-center justify-between bg-[#f5f2ed]/50">
            <h3 className="text-xl font-serif font-medium text-[#1a1a1a]">
              PDF Settings
            </h3>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="p-2 rounded-full hover:bg-black/5 transition-colors text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a]/80 mb-2">
                Document Title (Filename)
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="e.g., My Document"
                className="w-full px-4 py-2.5 bg-white border border-[#1a1a1a]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/20 transition-all text-[#1a1a1a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a]/80 mb-2">
                Header Text
              </label>
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g., Confidential Document"
                className="w-full px-4 py-2.5 bg-white border border-[#1a1a1a]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/20 transition-all text-[#1a1a1a]"
              />
              <p className="text-xs text-[#1a1a1a]/50 mt-1.5">
                Leave empty to use the default header (Title | Date).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a]/80 mb-2">
                Footer Text
              </label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g., Company Name"
                className="w-full px-4 py-2.5 bg-white border border-[#1a1a1a]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/20 transition-all text-[#1a1a1a]"
              />
            </div>

            <div className="pt-2 border-t border-[#1a1a1a]/10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPageNumbers}
                  onChange={(e) => setShowPageNumbers(e.target.checked)}
                  className="w-5 h-5 rounded border-[#1a1a1a]/20 text-[#1a1a1a] focus:ring-[#1a1a1a]/20 accent-[#1a1a1a]"
                />
                <span className="text-sm font-medium text-[#1a1a1a]/80">
                  Show Page Numbers
                </span>
              </label>
            </div>

            {showPageNumbers && (
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a]/80 mb-2">
                  Page Number Position
                </label>
                <select
                  value={pageNumberPosition}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setPageNumberPosition(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white border border-[#1a1a1a]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/20 transition-all text-[#1a1a1a]"
                >
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-[#1a1a1a]/10 bg-[#f5f2ed]/30 flex justify-end">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="px-6 py-2.5 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
