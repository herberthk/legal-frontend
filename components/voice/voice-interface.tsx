"use client";

import React, { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import AmbientGlow from "./interface/AmbientGlow";
import VoiceHeader from "./interface/VoiceHeader";
import VoiceVisualizer from "./interface/VoiceVisualizer";
import TranscriptPanel from "./interface/TranscriptPanel";
import VoiceControls from "./interface/VoiceControls";
import { statusConfig, statusPalette } from "./utils";
import {
  COST_PER_VOICE_SECOND_IN_CENTS,
  USD_TO_UGX_EXCHANGE_RATE,
} from "@/constants/constants";
import ExhastedBanner from "./ExhastedBanner";
import { useThemeStore } from "@/store";
import PostCallProgress from "./PostCallProgress";

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  wsStatus,
  audioStatus,
  duration,
  isResponding,
  activeTranscript,
  onStart,
  onEnd,
  isMuted,
  setIsMuted,
  isAudioMuted,
  setIsAudioMuted,
  listening,
  voiceName,
  userName,
  freeVoiceSeconds,
  isCreditExhausted,
  remainingSeconds,
  // Post-call state
  postCallStage,
  postCallError,
  encodingProgress,
  uploadProgress,
}) => {
  // ─── Derived UI Status ────────────────────────────────────────────────────
  const status: CallStatus = useMemo(() => {
    return wsStatus === "open"
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
  }, [wsStatus, audioStatus, isResponding, isMuted, listening]);

  const effectiveStatus: CallStatus | "error" = useMemo(() => {
    return wsStatus === "error" && status === "idle" ? "error" : status;
  }, [wsStatus, status]);
  const palette = statusPalette[effectiveStatus];

  // Use the app's zustand theme store as the single source of truth
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const { glowColor, ringColor, glowOpacity, glowOpacityActive } =
    useMemo(() => {
      const p = statusPalette[effectiveStatus];
      const isD = theme === "dark";
      return {
        glowColor: isD ? p.darkGlow : p.lightGlow,
        ringColor: isD ? p.darkRing : p.lightRing,
        glowOpacity: isD ? 0.4 : 0.7,
        glowOpacityActive: isD ? [0.3, 0.5, 0.3] : [0.6, 0.85, 0.6],
      };
    }, [effectiveStatus, theme]);

  const getDisplayText = () => {
    return activeTranscript?.text || "";
  };

  const isCallActive = wsStatus === "open";
  const isAudioActive = status === "listening" || status === "speaking";

  const currentConfig = statusConfig[wsStatus] || statusConfig.idle;

  const currentCostUSD = (duration * COST_PER_VOICE_SECOND_IN_CENTS) / 100;
  const currentCostUGX = Math.round(currentCostUSD * USD_TO_UGX_EXCHANGE_RATE);

  const showFreeTime = duration < freeVoiceSeconds;
  const remainingFreeSeconds = Math.max(0, freeVoiceSeconds - duration);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isNearingLimit = remainingSeconds < 300 && wsStatus === "open"; // 5 minutes
  const isCriticalLimit = remainingSeconds < 60; // 1 minute
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#0F172A] relative overflow-hidden transition-colors duration-500">
      {/* ── Ambient Glow ──────────────────────────────────────────────────── */}
      <AmbientGlow
        isDark={isDark}
        isAudioActive={isAudioActive}
        glowColor={glowColor}
        glowOpacityActive={glowOpacityActive}
        glowOpacity={glowOpacity}
      />

      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <VoiceHeader
        currentConfig={currentConfig}
        isCallActive={isCallActive}
        showFreeTime={showFreeTime}
        currentCostUSD={currentCostUSD}
        currentCostUGX={currentCostUGX}
        remainingFreeSeconds={remainingFreeSeconds}
        duration={duration}
      />

      {/* ── Main Visualizer ───────────────────────────────────────────────── */}
      <VoiceVisualizer
        status={status}
        wsStatus={wsStatus}
        effectiveStatus={effectiveStatus}
        palette={palette}
        ringColor={ringColor}
        glowColor={glowColor}
        isDark={isDark}
        isAudioActive={isAudioActive}
        voiceName={voiceName}
        onStart={onStart}
      />

      {/* ── Live Transcript Panel ────────────────────────────────────────── */}
      <TranscriptPanel
        wsStatus={wsStatus}
        status={status}
        getDisplayText={getDisplayText}
        userName={userName}
        voiceName={voiceName}
        activeTranscript={activeTranscript}
        palette={palette}
      />

      {/* ── Floating Controls ─────────────────────────────────────────────── */}
      {/* isRecording = call is open AND encoder is not yet running.
          Encoder starts the moment the call ends, so the REC dot stops
          showing as soon as the encoding overlay takes over. */}
      <VoiceControls
        wsStatus={wsStatus}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isAudioMuted={isAudioMuted}
        setIsAudioMuted={setIsAudioMuted}
        onEnd={onEnd}
        isRecording={wsStatus === "open" && !postCallStage}
        isPostCall={postCallStage !== null}
      />

      {/* ── Session Limit Warning Banner ──────────────────────────────────── */}
      {isNearingLimit && !isCreditExhausted && (
        <div
          className={`absolute top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2 rounded-full border shadow-2xl transition-all duration-500 flex items-center gap-3 backdrop-blur-xl ${
            isCriticalLimit
              ? "bg-red-500/90 border-red-400 text-white animate-pulse"
              : "bg-amber-500/90 border-amber-400 text-white"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
            Session ending in {formatTime(remainingSeconds)}
          </span>
        </div>
      )}
      {/* ── Credit Exhausted Banner ────────────────────────────────────────── */}
      {isCreditExhausted && <ExhastedBanner />}

      {/* ── Post Call Progress Overlay ─────────────────────────────────────────
          Shown after the call ends to display encoding, uploading, and saving progress.
      */}
      <AnimatePresence>
        {postCallStage && (
          <PostCallProgress
            stage={postCallStage}
            error={postCallError}
            encodingProgress={encodingProgress}
            uploadProgress={uploadProgress}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(VoiceInterface);
