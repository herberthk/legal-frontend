import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  MicOff,
  RefreshCcw,
  AlertCircle,
  Radio,
  Mic,
} from "lucide-react";
import {
  OrbRing,
  getStatusText,
  WaveBar,
  statusPalette,
  LiquidPulse,
} from "../utils";

interface VoiceVisualizerProps {
  status: CallStatus;
  wsStatus: VoiceSessionStatus;
  effectiveStatus: CallStatus | "error";
  palette: (typeof statusPalette)["idle"];
  ringColor: string;
  glowColor: string;
  isDark: boolean;
  isAudioActive: boolean;
  voiceName?: string;
  onStart: () => void;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  status,
  wsStatus,
  effectiveStatus,
  palette,
  ringColor,
  glowColor,
  isDark,
  isAudioActive,
  voiceName,
  onStart,
}) => {
  const isPreCall = wsStatus !== "open";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pt-16 pb-64 lg:pb-72 pointer-events-none">
      {/* ── Background Organic Waves ──────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {isPreCall && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-[40%_60%_70%_30%/40%_50%_60%_50%]"
                  style={{
                    width: `${450 + i * 180}px`,
                    height: `${450 + i * 180}px`,
                    border: `1.5px solid ${i % 2 === 0 ? palette.orbFrom : palette.orbTo}${isDark ? "15" : "30"}`,
                    background: `radial-gradient(circle, ${i % 2 === 0 ? palette.orbFrom : palette.orbTo}05 0%, transparent 70%)`,
                  }}
                  animate={{
                    rotate: i % 2 === 0 ? [0, 360] : [360, 0],
                    borderRadius: [
                      "40% 60% 70% 30% / 40% 50% 60% 50%",
                      "60% 40% 30% 70% / 50% 60% 40% 60%",
                      "40% 60% 70% 30% / 40% 50% 60% 50%",
                    ],
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    duration: 20 + i * 8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Text */}
      <AnimatePresence mode="wait">
        {wsStatus === "open" && (
          <motion.div
            key={status}
            className="flex flex-col items-center mb-6 pointer-events-auto text-center px-4"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <h2
              className={`text-xl sm:text-2xl font-bold ${palette.text} transition-colors duration-300 drop-shadow-sm`}
            >
              {getStatusText(status, wsStatus, voiceName)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 h-5 italic font-medium">
              {status === "speaking"
                ? "is responding..."
                : status === "listening"
                  ? "Speak clearly into your microphone"
                  : ""}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb + Rings */}
      <div className="relative w-48 h-48 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-auto">
        {/* Outer Dashed Spinner */}
        <OrbRing
          color={ringColor}
          size={280}
          status={status}
          dashed
          opacity={0.25}
        />

        {/* Mid Pulse Ring */}
        <OrbRing
          color={ringColor}
          size={230}
          status={status}
          delay={0.1}
          opacity={isDark ? 0.35 : 0.5}
        />

        {/* Inner Pulse Ring */}
        <OrbRing
          color={ringColor}
          size={180}
          status={status}
          delay={0.2}
          opacity={isDark ? 0.5 : 0.7}
        />

        {/* Center Orb */}
        <motion.div
          className={`relative z-10 w-24 h-24 sm:w-36 sm:h-36 rounded-full flex items-center justify-center overflow-hidden cursor-pointer`}
          // ${
          //   isPreCall
          //     ? "shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md"
          //     : "shadow-2xl"
          // }`}
          style={{
            boxShadow:
              //  isPreCall
              //   ? `
              //     0 0 ${isDark ? 80 : 60}px ${isDark ? 10 : 20}px ${glowColor}${isDark ? "30" : "60"},
              //     inset 0 4px 15px rgba(255,255,255,0.5),
              //     inset 0 -4px 15px rgba(0,0,0,0.3),
              //     inset 10px 10px 30px ${palette.orbFrom}80,
              //     inset -10px -10px 30px ${palette.orbTo}80
              //   `
              //   :
              `0 0 ${isDark ? 60 : 45}px ${isDark ? 8 : 16}px ${glowColor}${isDark ? "40" : "75"}`,
            border: isPreCall ? "2px solid rgba(255,255,255,0.4)" : "none",
          }}
          animate={{
            scale:
              status === "speaking"
                ? [1, 1.04, 1]
                : status === "listening"
                  ? [1, 1.02, 1]
                  : 1,
            filter:
              status === "idle" || status === "muted"
                ? "saturate(0.3) brightness(0.8)"
                : "saturate(1.2) brightness(1.05)",
          }}
          transition={{
            scale: {
              duration: status === "speaking" ? 1.5 : 1.2,
              repeat: isAudioActive ? Infinity : 0,
              ease: "easeInOut",
            },
            filter: { duration: 0.5 },
            background: { duration: 0.6 },
          }}
          whileHover={
            isPreCall
              ? { scale: 1.05, boxShadow: `0 0 100px 20px ${glowColor}50` }
              : undefined
          }
          whileTap={isPreCall ? { scale: 0.96 } : undefined}
        >
          <AnimatePresence mode="wait">
            {/* Connecting */}
            {wsStatus === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
                <LiquidPulse />
              </motion.div>
            )}

            {/* Processing */}
            {status === "processing" && (
              <motion.div
                key="processing"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.35 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <BrainCircuit className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
                </motion.div>
              </motion.div>
            )}

            {/* Speaking */}
            {status === "speaking" && (
              <motion.div
                key="speaking"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.35 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <BrainCircuit className="w-10 h-10 sm:w-14 sm:h-14 text-white" />
                </motion.div>
              </motion.div>
            )}

            {/* Listening — animated waveform bars */}
            {status === "listening" && (
              <motion.div
                key="listening"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex gap-0.5 sm:gap-1 items-center justify-center h-8 sm:h-10">
                  <WaveBar delay={0} heights={[8, 24, 8]} />
                  <WaveBar delay={0.15} heights={[20, 36, 20]} />
                  <WaveBar delay={0.05} heights={[14, 30, 14]} />
                  <WaveBar delay={0.2} heights={[10, 20, 10]} />
                  <WaveBar delay={0.1} heights={[18, 32, 18]} />
                </div>
              </motion.div>
            )}

            {/* Muted */}
            {status === "muted" && (
              <motion.div
                key="muted"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
              >
                <MicOff className="w-8 h-8 sm:w-12 sm:h-12 text-white/70" />
              </motion.div>
            )}

            {/* Disconnected / Closed */}
            {status === "closed" && (
              <motion.button
                key="closed"
                onClick={onStart}
                className="absolute inset-0 flex flex-col items-center justify-center text-white voice-box-shadow"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCcw className="w-10 h-10 sm:w-14 sm:h-14 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Restart
                </span>
              </motion.button>
            )}

            {/* Startup/Error Button Logic */}
            {(status === "idle" || effectiveStatus === "error") &&
              status !== "closed" &&
              wsStatus !== "connecting" && (
                <motion.button
                  key={effectiveStatus === "error" ? "retry-btn" : "start-btn"}
                  onClick={onStart}
                  className="absolute inset-0 flex flex-col items-center justify-center text-white bg-transparent! voice-box-shadow"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={{
                      y: [0, -5, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {effectiveStatus === "error" ? (
                      <AlertCircle className="w-12 h-12 sm:w-18 sm:h-18" />
                    ) : (
                      <Mic className="w-12 h-12 sm:w-18 sm:h-18 drop-shadow-lg" />
                    )}
                  </motion.div>
                  {effectiveStatus === "idle" && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 opacity-80"
                    >
                      Start
                    </motion.span>
                  )}
                </motion.button>
              )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Guidance Labels (Below Orb) ─────────────────────────────────── */}
      <div className="h-10 mt-8">
        <AnimatePresence>
          {wsStatus !== "open" && (
            <motion.div
              key={wsStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-1"
            >
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                {wsStatus === "idle" && "Click Mic to Start"}
                {wsStatus === "connecting" && "Establishing Secure Line..."}
                {wsStatus === "closed" && "Session Ended"}
                {wsStatus === "error" && "Connection Interrupted"}
              </p>
              {wsStatus === "error" && (
                <p className="text-xs text-red-500/70 font-medium">
                  Please check your network and try again
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default React.memo(VoiceVisualizer);
