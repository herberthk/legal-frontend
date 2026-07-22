import { RefreshCw, ServerCrash, X } from "lucide-react";
import React from "react";

type Props = {
  chatError: Error;
  dismissChatErrorBanner: () => void;
  handleRetry: () => void;
};
function ChatError({ chatError, dismissChatErrorBanner, handleRetry }: Props) {
  const errorMessage =
    chatError.message.replace('{"error":"', "").replace('"}', "")

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Chat error notice"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={dismissChatErrorBanner}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute -inset-px rounded-2xl bg-linear-to-br from-red-400 via-rose-400 to-red-500 opacity-60 blur-sm" />

        <div className="relative rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-linear-to-r from-red-400 via-rose-400 to-red-600" />

          <button
            onClick={dismissChatErrorBanner}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="p-8 pb-6">
            {/* Icon badge */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-linear-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 flex items-center justify-center shadow-inner">
                <ServerCrash
                  size={28}
                  className="text-red-500 dark:text-red-400"
                />
              </div>
            </div>

            {/* Text */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Request Failed
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                {errorMessage ||
                  "An unexpected error occurred while processing your request."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  dismissChatErrorBanner();
                  handleRetry();
                }}
                className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-linear-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold text-sm shadow-md shadow-red-500/30 transition-all duration-200 hover:shadow-red-500/50 hover:-translate-y-0.5"
              >
                <RefreshCw size={15} />
                Try Again
              </button>
              <button
                onClick={dismissChatErrorBanner}
                className="w-full py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatError;
