import React from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ChatDeleteModal: React.FC<ChatDeleteModalProps> = React.memo(({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Remove Document?
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Are you sure you want to remove this attached document? It will be permanently deleted from secure storage.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors rounded-lg shadow-sm shadow-red-500/20"
              >
                Remove
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

ChatDeleteModal.displayName = "ChatDeleteModal";
