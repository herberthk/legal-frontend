import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TranscriptPanelProps {
  wsStatus: VoiceSessionStatus;
  status: CallStatus;
  getDisplayText: () => string;
  userName?: string;
  voiceName?: string;
  activeTranscript: AgentTranscript | null;
  palette: { text: string };
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  wsStatus,
  status,
  getDisplayText,
  userName,
  voiceName,
  activeTranscript,
  palette,
}) => {
  if (wsStatus !== "open") return null;

  return (
    <div className="absolute bottom-26 left-0 w-full px-4 flex justify-center z-10 pointer-events-none">
      <motion.div
        className="w-full max-w-2xl sm:max-w-3xl bg-black/10 backdrop-blur-xs rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col pointer-events-none"
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
            {/* Transcript */}
            {getDisplayText() && (
              <motion.div
                key={activeTranscript?.speaker === "ai" ? "ai" : "user"}
                className="flex flex-col items-center text-center max-w-2xl w-full"
                initial={{ opacity: 0, y: 16, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -16, filter: "blur(2px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <span
                  className={`text-xs sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-3 ${palette.text}`}
                >
                  {status === "listening"
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
            {!getDisplayText() && (
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
