import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";

interface VoiceControlsProps {
  wsStatus: VoiceSessionStatus;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isAudioMuted: boolean;
  setIsAudioMuted: (muted: boolean) => void;
  onEnd: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  wsStatus,
  isMuted,
  setIsMuted,
  isAudioMuted,
  setIsAudioMuted,
  onEnd,
}) => {
  if (wsStatus !== "open") return null;

  return (
    <motion.div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-fit"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3 sm:gap-6 bg-transparent backdrop-blur-2xl px-6 py-3 rounded-full shadow-[0_16px_48px_-8px_rgba(0,0,0,0.3)] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]">
        {/* Toggle Mic */}
        <motion.button
          onClick={() => setIsMuted(!isMuted)}
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full shadow-sm ${
            isMuted
              ? "bg-slate-200 dark:bg-slate-800 text-slate-500"
              : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          disabled={wsStatus !== "open"}
          whileHover={wsStatus === "open" ? { scale: 1.12 } : undefined}
          whileTap={wsStatus === "open" ? { scale: 0.92 } : undefined}
          animate={{
            opacity: wsStatus !== "open" ? 0.45 : 1,
          }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {isMuted ? (
              <motion.div
                key="micoff"
                initial={{ rotate: -30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 30, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MicOff size={18} className="sm:w-[22px]" />
              </motion.div>
            ) : (
              <motion.div
                key="micon"
                initial={{ rotate: 30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -30, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Mic size={18} className="sm:w-[22px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* End Call */}
        <motion.button
          onClick={onEnd}
          className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full shadow-lg ${
            wsStatus !== "open"
              ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
              : "bg-red-500 text-white shadow-red-500/40"
          }`}
          title="End Call"
          disabled={wsStatus !== "open"}
          whileHover={
            wsStatus === "open" ? { scale: 1.1, rotate: 15 } : undefined
          }
          whileTap={
            wsStatus === "open" ? { scale: 0.9, rotate: -10 } : undefined
          }
          animate={{ opacity: wsStatus !== "open" ? 0.45 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <PhoneOff size={24} className="sm:w-[28px]" />
        </motion.button>

        {/* Toggle Audio */}
        <motion.button
          onClick={() => setIsAudioMuted(!isAudioMuted)}
          className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full shadow-sm ${
            isAudioMuted
              ? "bg-slate-200 dark:bg-slate-800 text-slate-500"
              : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          }`}
          title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
          disabled={wsStatus !== "open"}
          whileHover={wsStatus === "open" ? { scale: 1.12 } : undefined}
          whileTap={wsStatus === "open" ? { scale: 0.92 } : undefined}
          animate={{ opacity: wsStatus !== "open" ? 0.45 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {isAudioMuted ? (
              <motion.div
                key="voloff"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <VolumeX size={18} className="sm:w-[22px]" />
              </motion.div>
            ) : (
              <motion.div
                key="volon"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Volume2 size={18} className="sm:w-[22px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default React.memo(VoiceControls);
