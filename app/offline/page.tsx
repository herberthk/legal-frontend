"use client";

import { WifiOff, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-4">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-8">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 scale-0 group-hover:scale-150 transition-transform duration-700 rounded-full" />
          <WifiOff className="w-12 h-12 text-slate-500 dark:text-slate-400 relative z-10" />
        </motion.div>

        <div className="space-y-3">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400"
          >
            You&apos;re Offline
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-600 dark:text-slate-400 text-lg max-w-sm mx-auto"
          >
            It looks like you&apos;ve lost your internet connection. Check your
            connection or try again.
          </motion.p>
        </div>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRetry}
          className="group relative flex items-center gap-2 px-8 py-3 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-semibold shadow-xl transition-all duration-300"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="group-active:animate-spin"
          >
            <RefreshCcw className="w-5 h-5" />
          </motion.div>
          Try Again
        </motion.button>
      </div>
    </div>
  );
}
