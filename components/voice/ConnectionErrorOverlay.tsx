"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  WifiOff,
  MicOff,
  ShieldAlert,
  ServerCrash,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";

interface ErrorConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  hint: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
}

const ERROR_CONFIG: Record<ConnectionErrorKind, ErrorConfig> = {
  offline: {
    icon: <WifiOff className="w-10 h-10" />,
    title: "You're Offline",
    description:
      "No internet connection detected. Please reconnect to continue your voice session.",
    hint: "Check your Wi-Fi, mobile data, or ethernet connection and try again.",
    color: "text-amber-400",
    bgGradient: "from-amber-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-amber-500/30",
    glowColor: "shadow-amber-500/20",
  },
  mic_denied: {
    icon: <MicOff className="w-10 h-10" />,
    title: "Microphone Access Denied",
    description:
      "Your browser blocked microphone access. The voice assistant needs it to hear you.",
    hint: "Click the lock/camera icon in your browser's address bar → allow microphone → refresh.",
    color: "text-rose-400",
    bgGradient: "from-rose-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-rose-500/30",
    glowColor: "shadow-rose-500/20",
  },
  mic_unavailable: {
    icon: <MicOff className="w-10 h-10" />,
    title: "No Microphone Found",
    description:
      "We couldn't find a microphone on your device. Please connect one and try again.",
    hint: "Plug in a headset or external microphone, then click retry.",
    color: "text-orange-400",
    bgGradient: "from-orange-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-orange-500/30",
    glowColor: "shadow-orange-500/20",
  },
  token_failed: {
    icon: <ShieldAlert className="w-10 h-10" />,
    title: "Authentication Failed",
    description:
      "We couldn't verify your session with the AI service. This is usually a temporary issue.",
    hint: "Wait a moment and try again. If the problem persists, try signing out and back in.",
    color: "text-purple-400",
    bgGradient: "from-purple-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/20",
  },
  timeout: {
    icon: <Clock className="w-10 h-10" />,
    title: "Connection Timed Out",
    description:
      "The voice service took too long to establish a real-time connection. Your network may be blocking WebSockets, or the server is busy.",
    hint: "If your internet is strong, your network provider or firewall might block WebSocket streaming. Try disabling VPNs/proxies or switching networks.",
    color: "text-blue-400",
    bgGradient: "from-blue-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/20",
  },
  generic: {
    icon: <ServerCrash className="w-10 h-10" />,
    title: "Connection Failed",
    description:
      "Something went wrong while establishing the voice connection. Please try again.",
    hint: "If the issue keeps happening, check your network or contact support.",
    color: "text-red-400",
    bgGradient: "from-red-950/80 via-slate-950/90 to-slate-950/95",
    borderColor: "border-red-500/30",
    glowColor: "shadow-red-500/20",
  },
};

interface ConnectionErrorOverlayProps {
  kind: ConnectionErrorKind;
  /** Raw error message for debugging — shown in a small collapsed section */
  rawMessage?: string;
  onRetry: () => void;
  onDismiss: () => void;
}

const ConnectionErrorOverlay: React.FC<ConnectionErrorOverlayProps> = ({
  kind,
  rawMessage,
  onRetry,
  onDismiss,
}) => {
  const cfg = ERROR_CONFIG[kind];

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Dark scrim */}
      <div className="absolute inset-0 bg-slate-950/70" />

      {/* Card */}
      <motion.div
        className={`relative w-full max-w-sm rounded-3xl border bg-linear-to-b ${cfg.bgGradient} ${cfg.borderColor} shadow-2xl ${cfg.glowColor} overflow-hidden`}
        initial={{ scale: 0.88, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
      >
        {/* Decorative top glow streak */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full blur-sm opacity-60`}
          style={{
            background: cfg.glowColor.replace("shadow-", "").replace("/20", ""),
          }}
        />

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 flex flex-col items-center text-center gap-5">
          {/* Animated icon */}
          <motion.div
            className={`${cfg.color} bg-white/5 rounded-2xl p-4 border border-white/10`}
            animate={{
              y: [0, -6, 0],
              boxShadow: [
                "0 0 0px 0px transparent",
                `0 8px 30px 4px currentColor`,
                "0 0 0px 0px transparent",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {cfg.icon}
          </motion.div>

          {/* Title */}
          <div className="space-y-2">
            <h3 className={`text-xl font-bold ${cfg.color} tracking-tight`}>
              {cfg.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {cfg.description}
            </p>
          </div>

          {/* Hint pill */}
          <div
            className={`w-full rounded-xl bg-white/5 border ${cfg.borderColor} px-4 py-3`}
          >
            <p className="text-xs text-slate-400 leading-relaxed">{cfg.hint}</p>
          </div>

          {/* Raw error (collapsed) */}
          {rawMessage && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors">
                Technical details
              </summary>
              <p className="mt-2 text-[10px] font-mono text-slate-500 bg-black/30 rounded-lg p-2 break-all">
                {rawMessage}
              </p>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 w-full pt-1">
            <button
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-400 border border-white/10 hover:bg-white/5 transition-all duration-200"
            >
              Dismiss
            </button>
            <motion.button
              onClick={onRetry}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200`}
              style={{
                background: `linear-gradient(135deg, ${
                  kind === "offline"
                    ? "#d97706, #b45309"
                    : kind === "mic_denied" || kind === "mic_unavailable"
                      ? "#e11d48, #be123c"
                      : kind === "token_failed"
                        ? "#7c3aed, #6d28d9"
                        : kind === "timeout"
                          ? "#2563eb, #1d4ed8"
                          : "#dc2626, #b91c1c"
                })`,
              }}
              whileHover={{ scale: 1.03, filter: "brightness(1.05)" }}
              whileTap={{ scale: 0.97 }}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConnectionErrorOverlay;
