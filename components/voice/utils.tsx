import React from "react";
import { motion } from "framer-motion";
// ─── Color Palette per Status ───────────────────────────────────────────────
// Each status has separate tuned values for light vs dark backgrounds.
export const statusPalette: Record<
  CallStatus | "error",
  {
    lightGlow: string;
    darkGlow: string;
    lightRing: string;
    darkRing: string;
    orbFrom: string;
    orbTo: string;
    text: string;
  }
> = {
  idle: {
    lightGlow: "#6366f1", // Indigo 500
    darkGlow: "#4338ca", // Indigo 700
    lightRing: "#818cf8", // Indigo 400
    darkRing: "#4f46e5", // Indigo 600
    orbFrom: "#a5b4fc", // Indigo 300
    orbTo: "#6366f1", // Indigo 500
    text: "text-indigo-600 dark:text-indigo-400",
  },
  listening: {
    lightGlow: "#2dd4bf", // Teal 400
    darkGlow: "#0d9488", // Teal 600
    lightRing: "#5eead4", // Teal 300
    darkRing: "#14b8a6", // Teal 500
    orbFrom: "#99f6e4", // Teal 200
    orbTo: "#2dd4bf", // Teal 400
    text: "text-teal-500 dark:text-teal-400",
  },
  processing: {
    lightGlow: "#a855f7", // Purple 500
    darkGlow: "#7e22ce", // Purple 700
    lightRing: "#c084fc", // Purple 400
    darkRing: "#9333ea", // Purple 600
    orbFrom: "#d8b4fe", // Purple 300
    orbTo: "#a855f7", // Purple 500
    text: "text-purple-600 dark:text-purple-400",
  },
  speaking: {
    lightGlow: "#06b6d4", // Cyan 500
    darkGlow: "#0891b2", // Cyan 700
    lightRing: "#22d3ee", // Cyan 400
    darkRing: "#06b6d4", // Cyan 600
    orbFrom: "#67e8f9", // Cyan 300
    orbTo: "#0891b2", // Cyan 600
    text: "text-cyan-600 dark:text-cyan-400",
  },
  muted: {
    lightGlow: "#64748b", // Slate 500
    darkGlow: "#334155", // Slate 700
    lightRing: "#94a3b8", // Slate 400
    darkRing: "#475569", // Slate 600
    orbFrom: "#cbd5e1", // Slate 300
    orbTo: "#64748b", // Slate 500
    text: "text-slate-400 dark:text-slate-500",
  },
  closed: {
    lightGlow: "#10b981", // Emerald 500
    darkGlow: "#059669", // Emerald 600
    lightRing: "#34d399", // Emerald 400
    darkRing: "#10b981", // Emerald 500
    orbFrom: "#6ee7b7", // Emerald 300
    orbTo: "#10b981", // Emerald 500
    text: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    lightGlow: "#ef4444", // Red 500
    darkGlow: "#b91c1c", // Red 700
    lightRing: "#f87171", // Red 400
    darkRing: "#dc2626", // Red 600
    orbFrom: "#fca5a5", // Red 300
    orbTo: "#ef4444", // Red 500
    text: "text-red-500 dark:text-red-400",
  },
};

// ─── Liquid Pulse (Connecting state) ──────────────────────────────────────────
export const LiquidPulse = React.memo(() => (
  <div className="absolute inset-0 flex items-center justify-center">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="absolute w-full h-full rounded-full border-2 border-white/30"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{
          scale: [0.8, 1.5],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: i * 0.6,
          ease: "easeOut",
        }}
      />
    ))}
    <motion.div
      className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.8, 1, 0.8],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  </div>
));
LiquidPulse.displayName = "LiquidPulse";

// ─── Animated Waveform Bars ──────────────────────────────────────────────────
export const WaveBar = React.memo<{ delay: number; heights: number[] }>(
  ({ delay, heights }) => (
    <motion.div
      className="w-1 sm:w-1.5 bg-white rounded-full"
      animate={{ height: heights }}
      transition={{
        duration: 0.6,
        repeat: Infinity,
        repeatType: "mirror",
        delay,
        ease: "easeInOut",
      }}
      style={{ height: heights[0] }}
    />
  ),
);
WaveBar.displayName = "WaveBar";

// ─── Ring Component ──────────────────────────────────────────────────────────
export const OrbRing = React.memo<{
  color: string;
  size: number;
  status: CallStatus;
  delay?: number;
  opacity?: number;
  dashed?: boolean;
}>(({ color, size, status, delay = 0, opacity = 0.4, dashed = false }) => {
  const isActive = status === "listening" || status === "speaking";
  const isPulsing = status === "listening";
  const isSpeaking = status === "speaking";

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        top: "50%",
        left: "50%",
        x: "-50%",
        y: "-50%",
        border: dashed ? `1.5px dashed ${color}` : `1.5px solid ${color}`,
        boxShadow: isActive ? `0 0 40px 4px ${color}30` : "none",
        willChange: "transform, opacity",
      }}
      animate={
        dashed
          ? {
              rotate: isActive ? 360 : 0,
              scale: isActive ? 1.25 : 1,
              opacity: isActive ? 0.25 : 0.04,
            }
          : isPulsing
            ? {
                scale: [1, 1.12, 1],
                opacity: [opacity * 0.6, opacity, opacity * 0.6],
              }
            : isSpeaking
              ? {
                  scale: [1, 1.1, 1],
                  opacity: [opacity, opacity * 1.3, opacity],
                  borderWidth: [1.5, 3, 1.5],
                }
              : { scale: 1, opacity: opacity }
      }
      transition={
        dashed
          ? {
              rotate: { duration: 12, ease: "linear", repeat: Infinity },
              scale: { duration: 0.8 },
              opacity: { duration: 0.8 },
            }
          : {
              duration: isSpeaking ? 1 : 2,
              repeat: isActive ? Infinity : 0,
              ease: "easeInOut",
              delay,
            }
      }
    />
  );
});
OrbRing.displayName = "OrbRing";

export const getStatusText = (
  status: CallStatus,
  wsStatus: VoiceSessionStatus,
  voiceName?: string,
) => {
  switch (status) {
    case "listening":
      return "Listening...";
    case "processing":
      return "Analyzing...";
    case "speaking":
      return voiceName || "Legal Adviser";
    case "muted":
      return "Microphone Muted";
    case "closed":
      return "Session Ended";
    case "idle":
      return wsStatus === "connecting"
        ? "Connecting..."
        : wsStatus === "open"
          ? "Ready"
          : "";
    default:
      return "";
  }
};

// ─── Hoisted Constants & Utilities ──────────────────────────────────────────
export const statusConfig = {
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

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// ─── Sub-components for localized re-renders ────────────────────────────────
export const VoiceTimer = React.memo(
  ({ duration, isCallActive }: { duration: number; isCallActive: boolean }) => (
    <motion.div
      className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg dark:shadow-slate-950/50 font-mono text-base sm:text-lg font-bold text-slate-800 dark:text-white min-w-[124px] sm:min-w-[145px] text-center tabular-nums"
      animate={{ opacity: isCallActive ? 1 : 0.5 }}
    >
      {formatTime(duration)}
    </motion.div>
  ),
);
VoiceTimer.displayName = "VoiceTimer";
