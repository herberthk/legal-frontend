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
  User as UserIcon,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { CallStatus, Transcript } from "./types";

interface VoiceInterfaceProps {
  wsStatus: VoiceSessionStatus;
  audioStatus: VoiceAudioStatus;
  duration: number;
  isResponding: boolean;
  activeTranscript: Transcript | null;
  currentTranscript: string; // Live transcript from STT

  onStart: () => void;
  onEnd: () => void;
  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
  isAudioMuted: boolean;
  setIsAudioMuted: (val: boolean) => void;
  userName?: string;
  listening: boolean; // Engine specific listening state
}

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
        return "from-amber-400 to-orange-500 border-orange-500/50 shadow-orange-500/30";
      case "processing":
        return "from-slate-400 to-slate-500 border-slate-500/50 shadow-slate-500/30";
      case "speaking":
        return "from-indigo-500 to-purple-600 border-indigo-500/50 shadow-indigo-500/30";
      case "idle":
        if (wsStatus === "error") {
          return "from-red-500 to-red-600 border-red-600/50 shadow-red-600/30";
        }
        return "from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 border-slate-300 dark:border-slate-700 shadow-transparent";
      default:
        return "from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 border-slate-300 dark:border-slate-700 shadow-transparent";
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
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-20 transition-all duration-1000 ${
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
        <div className="flex items-center space-x-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentConfig.dot}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${currentConfig.color}`}
            ></span>
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <Radio size={14} /> {currentConfig.label}
          </span>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm font-mono text-lg font-bold text-slate-800 dark:text-white truncate min-w-[100px] text-center">
          {formatTime(duration)}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pt-16 pb-64 lg:pb-72 pointer-events-none">
        <div className="flex flex-col items-center justify-center mb-6 pointer-events-auto text-center px-4">
          {wsStatus === "open" && (
            <h2
              className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${status === "listening" ? "text-orange-600 dark:text-orange-400" : status === "speaking" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
            >
              {getStatusText()}
            </h2>
          )}
          {/* <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 h-5">
            {status === "speaking"
              ? "AI is generating a response"
              : status === "listening"
                ? "Speak clearly into your microphone"
                : ""}
          </p> */}
        </div>

        {/* Animated Rings Container */}
        <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-auto">
          {/* Ring 3 (Outer) */}
          <div
            className={`absolute inset-0 rounded-full border-[1.5px] border-dashed transition-all duration-2000 ${getVisualizerColors()} ${status === "listening" || status === "speaking" ? "animate-[spin_8s_linear_infinite] scale-150 opacity-20" : "scale-100 opacity-5"}`}
          />

          {/* Ring 2 */}
          <div
            className={`absolute inset-4 rounded-full border outline-none transition-all duration-700 ${getVisualizerColors()} ${status === "listening" ? "animate-pulse scale-125 opacity-40" : status === "speaking" ? "animate-[pulse_1s_ease-in-out_infinite] scale-110 opacity-60" : "scale-100 opacity-10"}`}
          />

          {/* Ring 1 (Inner) */}
          <div
            className={`absolute inset-8 rounded-full border-2 transition-all duration-300 ${getVisualizerColors()} ${status === "listening" ? "scale-110 opacity-70" : status === "speaking" ? "scale-105 opacity-90 shadow-2xl" : "scale-100 opacity-20"}`}
          />

          {/* Center Orb */}
          <div
            className={`relative z-10 w-24 h-24 rounded-full bg-linear-to-br flex items-center justify-center shadow-lg transition-all duration-500 ${getVisualizerColors()} ${status === "idle" ? "grayscale opacity-80" : "saturate-150"}`}
          >
            {status === "processing" ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : status === "speaking" ? (
              <BrainCircuit className="w-10 h-10 text-white animate-pulse" />
            ) : status === "listening" ? (
              <div className="flex gap-1 items-center justify-center h-10">
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-6" />
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s] h-10" />
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s] h-8" />
                <div className="w-1.5 bg-white rounded-full animate-bounce h-5" />
              </div>
            ) : wsStatus === "error" ? (
              <button
                onClick={onStart}
                className="w-full h-full rounded-full flex flex-col items-center justify-center text-white"
              >
                <AlertCircle className="w-10 h-10 mb-1" />
                <span className="text-[10px] font-bold uppercase">Retry</span>
              </button>
            ) : (
              <button
                onClick={onStart}
                className="w-full h-full rounded-full flex items-center justify-center"
              >
                <Mic className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Speaker Focus Panel */}
      <div className="absolute bottom-20 left-0 w-full px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl bg-transparent backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-56 transition-all pointer-events-auto">
          <div className="flex-1 p-4 flex items-center justify-center relative">
            {status === "processing" ? (
              <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner mb-6">
                  <BrainCircuit size={24} strokeWidth={1.5} />
                </div>
                <div className="flex items-center space-x-2.5 h-8">
                  <span
                    className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse opacity-80"
                    style={{ animationDuration: "1s" }}
                  ></span>
                  <span
                    className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse opacity-80"
                    style={{ animationDelay: "200ms", animationDuration: "1s" }}
                  ></span>
                  <span
                    className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse opacity-80"
                    style={{ animationDelay: "400ms", animationDuration: "1s" }}
                  ></span>
                </div>
                <span className="mt-4 text-sm font-semibold text-slate-500 uppercase tracking-widest">
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
                <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 sm:mb-4">
                  {status === "speaking" ||
                  (activeTranscript?.speaker === "ai" && status === "idle")
                    ? "Legal Adviser"
                    : "You"}
                </h4>
                <p
                  className={`text-sm italic ${
                    status === "speaking" ||
                    (activeTranscript?.speaker === "ai" && status === "idle")
                      ? "text-slate-800 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {getDisplayText()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center opacity-40">
                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Mic size={28} className="text-slate-500" />
                </div>
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
      {/* {wsStatus === "open" && ( */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-4 sm:gap-6 bg-transparent backdrop-blur-xl px-6 py-2 rounded-full shadow-2xl">
          {/* Toggle Mic */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shadow-md ${isMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110"}`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* End Call */}
          <button
            onClick={onEnd}
            className={`w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 shadow-lg ${status === "idle" ? "bg-slate-200 dark:bg-slate-800 text-slate-400" : "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 hover:rotate-135"}`}
            title="End Call"
          >
            <PhoneOff size={24} />
          </button>

          {/* Toggle Audio */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shadow-md ${isAudioMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110"}`}
            title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
      {/* )} */}
    </div>
  );
};

export default VoiceInterface;
