"use client";

import React from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  BrainCircuit,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import classNames from "classnames";

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
      : "idle";

  // Format duration SS to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getVisualizerColors = () => {
    switch (status) {
      case "listening":
        return "from-amber-400 to-orange-500 border-orange-500/50 shadow-orange-500/30 dark:from-orange-500 dark:to-orange-600 dark:shadow-orange-900/40";
      case "processing":
        return "from-slate-400 to-slate-500 border-slate-500/50 shadow-slate-500/30 dark:from-slate-500 dark:to-slate-600 dark:shadow-slate-900/40";
      case "speaking":
        return "from-indigo-500 to-purple-600 border-indigo-500/50 shadow-indigo-500/30 dark:from-indigo-600 dark:to-purple-700 dark:shadow-indigo-900/40";
      case "muted":
        return "from-slate-300 to-slate-400 dark:from-slate-800 dark:to-slate-900 border-slate-400 dark:border-slate-800 shadow-transparent grayscale";
      case "idle":
        if (wsStatus === "error") {
          return "from-red-500 to-red-600 border-red-600/50 shadow-red-600/30 dark:from-red-600 dark:to-red-700 dark:shadow-red-900/40";
        }
        return "from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-800 shadow-transparent";
      default:
        return "from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-800 shadow-transparent";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "listening":
        return "Listening to you...";
      case "processing":
        return "Analyzing request...";
      case "speaking":
        return "Legal Adviser speaking...";
      case "muted":
        return "Microphone muted";
      case "idle":
        return wsStatus === "connecting" ? "Connecting..." : "Idle";
      default:
        return wsStatus === "connecting" ? "Connecting..." : "Idle";
    }
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#0F172A] relative overflow-hidden transition-colors duration-500">
      {/* Background Decorative Blur */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] lg:w-[800px] lg:h-[800px] rounded-full blur-[80px] sm:blur-[120px] opacity-20 sm:opacity-30 transition-all duration-1000 ${
          status === "listening"
            ? "bg-orange-500 scale-110"
            : status === "speaking"
              ? "bg-indigo-600 scale-125"
              : status === "processing"
                ? "bg-slate-400 scale-100"
                : "bg-slate-300 dark:bg-slate-800 scale-90"
        }`}
      />

      {/* Top Header */}
      <div className="shrink-0 flex justify-between items-center p-4 sm:p-6 z-20 relative">
        <div className="flex items-center space-x-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg dark:shadow-slate-950/50">
          <div className="relative flex h-2 w-2 sm:h-3 sm:w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentConfig.dot}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 ${currentConfig.color}`}
            ></span>
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
            <Radio size={12} className="sm:w-3.5 sm:h-3.5" />{" "}
            {currentConfig.label}
          </span>
        </div>
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border border-white/50 dark:border-slate-700/50 shadow-lg dark:shadow-slate-950/50 font-mono text-base sm:text-lg font-bold text-slate-800 dark:text-white truncate min-w-[80px] sm:min-w-[100px] text-center">
          {formatTime(duration)}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pt-16 pb-64 lg:pb-72 pointer-events-none">
        <div className="flex flex-col items-center justify-center mb-6 pointer-events-auto text-center px-4">
          {wsStatus === "open" && (
            <h2
              className={classNames(
                "text-xl sm:text-2xl font-bold transition-colors duration-300",
                {
                  "text-orange-600 dark:text-orange-400":
                    status === "listening",
                  "text-indigo-600 dark:text-indigo-400": status === "speaking",
                  "text-slate-800 dark:text-white": status === "idle",
                },
              )}
            >
              {getStatusText()}
            </h2>
          )}
          <p
            className={classNames(
              "text-xs sm:text-sm text-black dark:text-slate-400 mt-2 h-5 italic",
              {
                "animate-pulse": status === "speaking",
              },
            )}
          >
            {status === "speaking"
              ? "AI is responding..."
              : status === "listening"
                ? "Speak clearly into your microphone"
                : ""}
          </p>
        </div>

        {/* Animated Rings Container */}
        <div className="relative w-48 h-48 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-auto">
          {/* Ring 3 (Outer) */}
          <div
            className={`absolute inset-0 rounded-full border-[1.5px] border-dashed transition-all duration-[2000ms] ${getVisualizerColors()} ${
              status === "listening" || status === "speaking"
                ? "animate-[spin_10s_linear_infinite] scale-125 sm:scale-150 opacity-20"
                : "scale-100 opacity-5"
            }`}
          />

          {/* Ring 2 */}
          <div
            className={`absolute inset-4 rounded-full border outline-none transition-all duration-700 ${getVisualizerColors()} ${
              status === "listening"
                ? "animate-pulse scale-110 sm:scale-125 opacity-30 sm:opacity-40"
                : status === "speaking"
                  ? "animate-[pulse_1.5s_ease-in-out_infinite] scale-105 sm:scale-110 opacity-50 sm:opacity-60"
                  : "scale-100 opacity-10"
            }`}
          />

          {/* Ring 1 (Inner) */}
          <div
            className={`absolute inset-8 rounded-full border-2 transition-all duration-300 ${getVisualizerColors()} ${
              status === "listening"
                ? "scale-105 sm:scale-110 opacity-70"
                : status === "speaking"
                  ? "scale-105 sm:scale-110 opacity-90 shadow-2xl"
                  : "scale-100 opacity-20"
            }`}
          />

          {/* Center Orb */}
          <div
            className={`relative z-10 w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-linear-to-br flex items-center justify-center shadow-2xl transition-all duration-500 overflow-hidden ${getVisualizerColors()} ${status === "idle" ? "grayscale opacity-80" : "saturate-150"}`}
          >
            {/* Inner Glare Effect */}
            <div className="absolute inset-0 bg-white/10 dark:bg-white/5 pointer-events-none rounded-full blur-sm -translate-y-1/2 -translate-x-1/4 scale-75" />

            <div className="relative z-20 flex items-center justify-center w-full h-full">
              {status === "processing" ? (
                <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 text-white animate-spin" />
              ) : status === "speaking" ? (
                <BrainCircuit className="w-10 h-10 sm:w-14 sm:h-14 text-white animate-pulse" />
              ) : status === "listening" ? (
                <div className="flex gap-0.5 sm:gap-1 items-center justify-center h-8 sm:h-10">
                  <div className="w-1 sm:w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-4 sm:h-6" />
                  <div className="w-1 sm:w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s] h-7 sm:h-10" />
                  <div className="w-1 sm:w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s] h-5 sm:h-8" />
                  <div className="w-1 sm:w-1.5 bg-white rounded-full animate-bounce h-3 sm:h-5" />
                </div>
              ) : wsStatus === "error" ? (
                <button
                  onClick={onStart}
                  className="w-full h-full flex flex-col items-center justify-center text-white hover:scale-105 transition-transform"
                >
                  <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 mb-0.5 sm:mb-1" />
                  <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                    Retry
                  </span>
                </button>
              ) : (
                <button
                  onClick={onStart}
                  className="w-full h-full flex items-center justify-center group"
                >
                  <div className="relative">
                    <Mic className="w-8 h-8 sm:w-12 sm:h-12 text-slate-500 dark:text-slate-400 group-hover:scale-110 group-hover:text-slate-700 dark:group-hover:text-white transition-all" />
                    <div className="absolute inset-0 bg-white/20 blur-md rounded-full scale-0 group-hover:scale-150 transition-transform opacity-0 group-hover:opacity-100" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Speaker Focus Panel */}
      <div className="absolute bottom-24 sm:bottom-28 left-0 w-full px-4 sm:px-8 flex justify-center z-10 pointer-events-none">
        <div className="w-full max-w-2xl sm:max-w-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/50 dark:border-slate-800/50 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col min-h-48 sm:min-h-64 transition-all pointer-events-auto">
          <div className="flex-1 p-6 sm:p-10 flex items-center justify-center relative">
            {status === "processing" ? (
              <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner mb-4 sm:mb-6">
                  <BrainCircuit
                    size={28}
                    className="sm:w-8 sm:h-8"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex items-center space-x-2 h-6 sm:h-8">
                  <span className="w-2 sm:w-3 h-2 sm:h-3 bg-indigo-500 rounded-full animate-bounce animation-duration-[1s]" />
                  <span className="w-2 sm:w-3 h-2 sm:h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:200ms] animation-duration-[1s]" />
                  <span className="w-2 sm:w-3 h-2 sm:h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:400ms] animation-duration-[1s]" />
                </div>
                <span className="mt-3 sm:mt-4 text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  Analyzing...
                </span>
              </div>
            ) : getDisplayText() ? (
              <div className="flex flex-col items-center text-center max-w-2xl w-full animate-in slide-in-from-bottom-4 duration-500">
                {/* <div
                  className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg mb-4 transition-all duration-300 ${
                    status === "speaking" ||
                    (activeTranscript?.speaker === "ai" && status === "idle")
                      ? "bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30"
                      : "bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-orange-500/30"
                  }`}
                >
                  {status === "speaking" ||
                  (activeTranscript?.speaker === "ai" && status === "idle") ? (
                    <BrainCircuit size={24} className="sm:w-7 sm:h-7" />
                  ) : (
                    <UserIcon size={24} className="sm:w-7 sm:h-7" />
                  )}
                </div> */}
                <h4 className="text-sm uppercase text-black dark:text-slate-500 mb-3 sm:mb-4">
                  {status === "speaking" ||
                  (activeTranscript?.speaker === "ai" && status === "idle")
                    ? "Legal Adviser"
                    : "You"}
                </h4>
                <p className="text-xs italic font-normal text-black dark:text-slate-200">
                  {getDisplayText()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center opacity-40">
                {/* <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Mic size={28} className="text-slate-500" />
                </div> */}
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                  {wsStatus === "error"
                    ? "Connection Failed"
                    : status === "idle" && wsStatus === "idle"
                      ? "Click Mic to Start"
                      : "Awaiting Speech..."}
                </p>
                {wsStatus === "error" && (
                  <button
                    onClick={onStart}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <RefreshCcw size={14} /> Retry Now
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Call Controls */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-fit">
        <div className="flex items-center gap-3 sm:gap-6 bg-transparent backdrop-blur-2xl px-4 py-3 sm:px-6 sm:py-4 rounded-full shadow-[0_16px_48px_-8px_rgba(0,0,0,0.3)] dark:shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]">
          {/* Toggle Mic */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm ${isMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110 active:scale-95"}`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            disabled={status === "idle"}
          >
            {isMuted ? (
              <MicOff size={18} className="sm:w-[22px]" />
            ) : (
              <Mic size={18} className="sm:w-[22px]" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={onEnd}
            className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-90 shadow-lg ${status === "idle" ? "bg-slate-200 dark:bg-slate-800 text-slate-400" : "bg-red-500 hover:bg-red-600 text-white shadow-red-500/40 hover:rotate-90 sm:hover:rotate-135"}`}
            title="End Call"
            disabled={status === "idle"}
          >
            <PhoneOff size={24} className="sm:w-[28px]" />
          </button>

          {/* Toggle Audio */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm ${isAudioMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110 active:scale-95"}`}
            title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
            disabled={status === "idle"}
          >
            {isAudioMuted ? (
              <VolumeX size={18} className="sm:w-[22px]" />
            ) : (
              <Volume2 size={18} className="sm:w-[22px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;
