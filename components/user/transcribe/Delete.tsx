import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2 } from "lucide-react";

interface DeleteModalProps {
  recordToDelete: TranscriptionRecord | null;
  onClose: () => void;
  onDelete: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteModal = memo(({
  recordToDelete,
  onClose,
  onDelete,
  isDeleting,
}: DeleteModalProps) => {
  return (
    <AnimatePresence>
      {recordToDelete && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800"
          >
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white text-center mb-3">
              Delete Transcription?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
              Are you sure you want to delete{" "}
              <strong className="text-slate-700 dark:text-slate-300">
                &quot;{recordToDelete.title || "Untitled Document"}&quot;
              </strong>
              ? This action cannot be undone and will permanently remove the
              record and its associated file.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-500/30 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

DeleteModal.displayName = "DeleteModal";

export default DeleteModal;