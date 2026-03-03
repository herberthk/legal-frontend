"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/store/theme";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  BrainCircuit,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { getStatusText, OrbRing, statusPalette, WaveBar } from "./utils";

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  wsStatus,
  audioStatus,
  duration,
  isResponding,
  activeTranscript,
  currentTranscript,
  onStart,
  onEnd,
  isMuted,
  setIsMuted,
  isAudioMuted,
  setIsAudioMuted,
  listening,
  voiceName,
  userName,
}) => {
  // ─── Connection Status Mapping ───────────────────────────────────────────
  const statusConfig = {
    idle: { label: "Idle", color: "bg-slate-500", dot: "bg-slate-500" },
    connecting: {
      label: "Connecting...",
      color: "bg-yellow-500",
      dot: "bg-yellow-400",
    },
    open: {
      label: "Connected",
      color: "bg-green-500",
      dot: "bg-green-400",
    },
    closed: {
      label: "Disconnected",
      color: "bg-slate-500",
      dot: "bg-slate-500",
    },
    error: {
      label: "Connection Error",
      color: "bg-red-500",
      dot: "bg-red-400",
    },
  };

  const currentConfig = statusConfig[wsStatus] || statusConfig.idle;

  // ─── Derived UI Status ────────────────────────────────────────────────────
  const status: CallStatus =
    wsStatus === "open"
      ? audioStatus === "playing"
        ? "speaking"
        : isResponding
          ? "processing"
          : isMuted
            ? "muted"
            : listening
              ? "listening"
              : "idle"
      : wsStatus === "closed"
        ? "closed"
        : "idle";

  const effectiveStatus: CallStatus | "error" =
    wsStatus === "error" && status === "idle" ? "error" : status;
  const palette = statusPalette[effectiveStatus];

  // Use the app's zustand theme store as the single source of truth
  const isDark = useThemeStore((state) => state.theme) === "dark";
  const glowColor = isDark ? palette.darkGlow : palette.lightGlow;
  const ringColor = isDark ? palette.darkRing : palette.lightRing;
  // Light-mode needs significantly more opacity to stand out on white
  const glowOpacity = isDark ? 0.4 : 0.7;
  const glowOpacityActive = isDark ? [0.3, 0.5, 0.3] : [0.6, 0.85, 0.6];

  // Format duration SS to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getDisplayText = () => {
    if (status === "listening") {
      return currentTranscript || activeTranscript?.text || "";
    }
    if (status === "speaking" || status === "processing") {
      return activeTranscript?.speaker === "ai" ? activeTranscript.text : "";
    }
    return activeTranscript?.text || "";
  };

  const isCallActive = wsStatus === "open";
  const isAudioActive = status === "listening" || status === "speaking";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#0F172A] relative overflow-hidden transition-colors duration-500">
      {/* ── Ambient Glow ──────────────────────────────────────────────────── */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          filter: isDark ? "blur(100px)" : "blur(80px)",
          width: isDark ? 600 : 500,
          height: isDark ? 600 : 500,
        }}
        animate={{
          backgroundColor: glowColor + (isDark ? "55" : "88"),
          scale: isAudioActive ? [1, 1.18, 1] : 0.75,
          opacity: isAudioActive ? glowOpacityActive : glowOpacity * 0.4,
        }}
        transition={{
          backgroundColor: { duration: 0.6 },
          scale: isAudioActive
            ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
            : { duration: 1.2 },
          opacity: isAudioActive
            ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
            : { duration: 1.2 },
        }}
      />

      {/* ── Top Header ────────────────────────────────────────────────────── */}
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

        {/* Timer */}
        <motion.div
          className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg dark:shadow-slate-950/50 font-mono text-base sm:text-lg font-bold text-slate-800 dark:text-white min-w-[80px] sm:min-w-[100px] text-center"
          animate={{ opacity: isCallActive ? 1 : 0.5 }}
        >
          {formatTime(duration)}
        </motion.div>
      </motion.div>

      {/* ── Main Visualizer ───────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pt-16 pb-64 lg:pb-72 pointer-events-none">
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
                className={`text-xl sm:text-2xl font-bold ${palette.text} transition-colors duration-300`}
              >
                {getStatusText(status, wsStatus, voiceName)}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 h-5 italic">
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
            className="relative z-10 w-24 h-24 sm:w-36 sm:h-36 rounded-full flex items-center justify-center overflow-hidden shadow-2xl cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${palette.orbFrom}, ${palette.orbTo})`,
              boxShadow: `0 0 ${isDark ? 60 : 45}px ${isDark ? 8 : 16}px ${glowColor}${isDark ? "40" : "75"}, inset 0 2px 10px rgba(255,255,255,0.3)`,
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
            whileHover={!isCallActive ? { scale: 1.05 } : undefined}
            whileTap={!isCallActive ? { scale: 0.97 } : undefined}
          >
            {/* Inner highlight */}
            <div className="absolute inset-0 bg-white/10 dark:bg-white/5 pointer-events-none rounded-full blur-sm -translate-y-1/2 -translate-x-1/4 scale-75" />

            <AnimatePresence mode="wait">
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
                  className="absolute inset-0 flex flex-col items-center justify-center text-white"
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
                status !== "closed" && (
                  <motion.button
                    key={
                      effectiveStatus === "error" ? "retry-btn" : "start-btn"
                    }
                    onClick={onStart}
                    className="absolute inset-0 flex flex-col items-center justify-center text-white"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={wsStatus === "connecting"}
                  >
                    <motion.div
                      animate={
                        wsStatus === "connecting"
                          ? { rotate: 360 }
                          : { rotate: 0 }
                      }
                      transition={
                        wsStatus === "connecting"
                          ? { duration: 2, repeat: Infinity, ease: "linear" }
                          : {}
                      }
                    >
                      {effectiveStatus === "error" ? (
                        <AlertCircle className="w-10 h-10 sm:w-14 sm:h-14" />
                      ) : wsStatus === "connecting" ? (
                        <Radio className="w-10 h-10 sm:w-14 sm:h-14 opacity-50" />
                      ) : (
                        <Mic className="w-10 h-10 sm:w-14 sm:h-14" />
                      )}
                    </motion.div>
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
                  {wsStatus === "closed" && "Session Securely Ended"}
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

      {/* ── Live Transcript Panel (Only visible when connected) ───────────── */}
      {wsStatus === "open" && (
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
                    {/* <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner mb-4 sm:mb-6">
                      <BrainCircuit
                        size={28}
                        className="sm:w-8 sm:h-8"
                        strokeWidth={1.5}
                      />
                    </div> */}
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
                      {status === "speaking" ||
                      (activeTranscript?.speaker === "ai" && status === "idle")
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
      )}

      {/* ── Floating Controls ─────────────────────────────────────────────── */}
      {wsStatus === "open" && (
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
                // backgroundColor: isMuted ? "#e2e8f0" : "#ffffff",
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
      )}
    </div>
  );
};

export default VoiceInterface;
