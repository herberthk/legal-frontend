import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Sparkles } from "lucide-react";
import { VoiceTimer, formatTime } from "../utils";

interface VoiceHeaderProps {
  currentConfig: { dot: string; color: string; label: string };
  isCallActive: boolean;
  showFreeTime: boolean;
  currentCostUSD: number;
  currentCostUGX: number;
  remainingFreeSeconds: number;
  duration: number;
}

const VoiceHeader: React.FC<VoiceHeaderProps> = ({
  currentConfig,
  isCallActive,
  showFreeTime,
  currentCostUSD,
  currentCostUGX,
  remainingFreeSeconds,
  duration,
}) => {
  return (
    <motion.div
      className="shrink-0 flex justify-between items-center p-4 sm:p-6 z-20 relative"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Connection Status */}
      <div className="flex items-center space-x-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg dark:shadow-slate-950/50">
        <div className="relative flex h-2 w-2 sm:h-3 sm:w-3">
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${currentConfig.dot}`}
            animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
          <span
            className={`relative inline-flex rounded-full h-full w-full ${currentConfig.color}`}
          />
        </div>
        <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
          <Radio size={12} className="sm:w-3.5 sm:h-3.5" />
          {currentConfig.label}
        </span>
      </div>

      {/* Timer & Credits */}
      <div className="flex items-center space-x-3 z-20">
        <AnimatePresence>
          {isCallActive && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 dark:border-slate-700/30 shadow-sm flex items-center gap-2 h-fit"
            >
              {!showFreeTime && (
                <div className="flex flex-col items-center leading-tight min-w-[70px] sm:min-w-[85px] tabular-nums">
                  <span className="text-base font-bold text-indigo-500 dark:text-indigo-400 tracking-tight">
                    ${currentCostUSD.toFixed(4)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {currentCostUGX.toLocaleString()} UGX
                  </span>
                </div>
              )}
              {showFreeTime && (
                <div className="flex items-center gap-1.5 min-w-[65px] sm:min-w-[80px] justify-end tabular-nums">
                  <Sparkles size={13} className="text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight whitespace-nowrap">
                    {formatTime(remainingFreeSeconds)}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <VoiceTimer duration={duration} isCallActive={isCallActive} />
      </div>
    </motion.div>
  );
};

export default React.memo(VoiceHeader);
