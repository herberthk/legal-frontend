"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // ── Register event listener ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // ── Interval Logic ──────────────────────────────────────────────────────
    const INTERVALS_MIN = [5, 10, 20, 30, 40, 50, 60]; // minutes from session start
    const STORAGE_KEY_START = "pwa_prompt_cycle_start";
    const STORAGE_KEY_INDEX = "pwa_prompt_last_index";

    // Initialize cycle start time if not present
    if (!localStorage.getItem(STORAGE_KEY_START)) {
      localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
      localStorage.setItem(STORAGE_KEY_INDEX, "-1");
    }

    const checkInterval = setInterval(() => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        clearInterval(checkInterval);
        return;
      }

      const cycleStart = parseInt(
        localStorage.getItem(STORAGE_KEY_START) || "0",
        10,
      );
      const lastIndex = parseInt(
        localStorage.getItem(STORAGE_KEY_INDEX) || "-1",
        10,
      );
      const elapsedMin = (Date.now() - cycleStart) / 60000;

      const nextIndex = lastIndex + 1;
      let targetMin = 0;

      if (nextIndex < INTERVALS_MIN.length) {
        targetMin = INTERVALS_MIN[nextIndex];
      } else {
        // After the last specific interval, show every 60 minutes
        const extraHours = nextIndex - INTERVALS_MIN.length + 1;
        targetMin = INTERVALS_MIN[INTERVALS_MIN.length - 1] + extraHours * 60;
      }

      if (elapsedMin >= targetMin && deferredPrompt && !showPrompt) {
        setShowPrompt(true);
        localStorage.setItem(STORAGE_KEY_INDEX, nextIndex.toString());
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      clearInterval(checkInterval);
    };
  }, [deferredPrompt, showPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-100 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4"
        >
          <div className="shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm md:text-base">
              Install LegalAdviser app
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add to your home screen for quick access and offline support.
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
