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
    lightGlow: "#4f46e5", // Indigo
    darkGlow: "#312e81",
    lightRing: "#6366f1",
    darkRing: "#4338ca",
    orbFrom: "#818cf8",
    orbTo: "#4f46e5",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  listening: {
    lightGlow: "#f97316", // Orange
    darkGlow: "#ea580c",
    lightRing: "#f97316",
    darkRing: "#fb923c",
    orbFrom: "#fb923c",
    orbTo: "#ea580c",
    text: "text-orange-500 dark:text-orange-400",
  },
  processing: {
    lightGlow: "#8b5cf6", // Violet
    darkGlow: "#5b21b6",
    lightRing: "#a78bfa",
    darkRing: "#7c3aed",
    orbFrom: "#c4b5fd",
    orbTo: "#8b5cf6",
    text: "text-violet-600 dark:text-violet-400",
  },
  speaking: {
    lightGlow: "#06b6d4", // Cyan
    darkGlow: "#0891b2",
    lightRing: "#22d3ee",
    darkRing: "#06b6d4",
    orbFrom: "#67e8f9",
    orbTo: "#0891b2",
    text: "text-cyan-600 dark:text-cyan-400",
  },
  muted: {
    lightGlow: "#64748b", // Slate
    darkGlow: "#334155",
    lightRing: "#94a3b8",
    darkRing: "#475569",
    orbFrom: "#94a3b8",
    orbTo: "#334155",
    text: "text-slate-400 dark:text-slate-500",
  },
  closed: {
    lightGlow: "#10b981", // Emerald
    darkGlow: "#059669",
    lightRing: "#34d399",
    darkRing: "#10b981",
    orbFrom: "#6ee7b7",
    orbTo: "#059669",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    lightGlow: "#ef4444", // Red
    darkGlow: "#b91c1c",
    lightRing: "#f87171",
    darkRing: "#dc2626",
    orbFrom: "#fca5a5",
    orbTo: "#b91c1c",
    text: "text-red-500 dark:text-red-400",
  },
};

// ─── Animated Waveform Bars ──────────────────────────────────────────────────
export const WaveBar: React.FC<{ delay: number; heights: number[] }> = ({
  delay,
  heights,
}) => (
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
);

// ─── Ring Component ──────────────────────────────────────────────────────────
export const OrbRing: React.FC<{
  color: string;
  size: number;
  status: CallStatus;
  delay?: number;
  opacity?: number;
  dashed?: boolean;
}> = ({ color, size, status, delay = 0, opacity = 0.4, dashed = false }) => {
  const isActive = status === "listening" || status === "speaking";
  const isPulsing = status === "listening";
  const isSpeaking = status === "speaking";

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        top: "50%",
        left: "50%",
        x: "-50%",
        y: "-50%",
        border: dashed ? `1.5px dashed ${color}` : `1.5px solid ${color}`,
        boxShadow: isActive ? `0 0 40px 4px ${color}30` : "none",
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
};

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
