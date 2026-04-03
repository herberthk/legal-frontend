import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TranscriptPanelProps {
  wsStatus: VoiceSessionStatus;
  status: CallStatus;
  getDisplayText: () => string;
  userName?: string;
  voiceName?: string;
  activeTranscript: AgentTranscript | null;
  currentTranscript: string;
  palette: { text: string };
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  wsStatus,
  status,
  getDisplayText,
  userName,
  voiceName,
  activeTranscript,
  currentTranscript,
  palette,
}) => {
  if (wsStatus !== "open") return null;

  return (
    <div className="absolute bottom-26 left-0 w-full px-4 flex justify-center z-10 pointer-events-none">
      <motion.div
        className="w-full max-w-2xl sm:max-w-3xl bg-transparent rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col pointer-events-auto"
        style={{ minHeight: "9rem" }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        layout
        transition={{ layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }}
      >
        <div className="flex-1 p-6 sm:p-10 flex items-center justify-center relative">
          <AnimatePresence mode="wait">
            {/* Processing */}
            {status === "processing" && (
              <motion.div
                key="proc-panel"
                className="flex flex-col items-center justify-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-end gap-1.5">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.span
                      key={i}
                      className="w-2 sm:w-3 h-2 sm:h-3 bg-indigo-500 rounded-full"
                      animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
                <span className="mt-4 text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  Thinking...
                </span>
              </motion.div>
            )}

            {/* Transcript */}
            {status !== "processing" && getDisplayText() && (
              <motion.div
                key={`${activeTranscript?.speaker ?? "none"}-${status}`}
                className="flex flex-col items-center text-center max-w-2xl w-full"
                initial={{ opacity: 0, y: 16, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(2px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <span
                  className={`text-xs sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-3 ${palette.text}`}
                >
                  {status === "listening" && currentTranscript
                    ? userName || "You"
                    : activeTranscript?.speaker === "ai"
                      ? voiceName || "Legal Adviser"
                      : userName || "You"}
                </span>
                <p className="text-xs italic font-light text-slate-800 dark:text-slate-100 leading-relaxed">
                  {getDisplayText()}
                </p>
              </motion.div>
            )}

            {/* Empty State / Listening Prompt */}
            {status !== "processing" && !getDisplayText() && (
              <motion.div
                key="listening-prompt"
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
                  Awaiting Neural Connection...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(TranscriptPanel);
