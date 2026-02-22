"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuthStore } from "@/store";

type CallStatus = "idle" | "listening" | "processing" | "speaking";
type Speaker = "user" | "ai" | "system";

interface Transcript {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: Date;
}

const mockSimulationFlow = [
  {
    status: "listening",
    duration: 3000,
    transcript:
      "Hello, I need some legal advice regarding property tax in Uganda.",
    speaker: "user",
  },
  { status: "processing", duration: 2500 },
  {
    status: "speaking",
    duration: 5000,
    transcript:
      "Hello! I can certainly help you with property tax under Ugandan law. According to the Local Governments (Rating) Act, property rates are levied on real property by local authorities. What specific aspect of property tax are you inquiring about?",
    speaker: "ai",
  },
  { status: "idle", duration: 2000 },
  {
    status: "listening",
    duration: 4000,
    transcript: "Are there any exemptions for residential buildings?",
    speaker: "user",
  },
  { status: "processing", duration: 2000 },
  {
    status: "speaking",
    duration: 6000,
    transcript:
      "Yes, under the Act, official residences of the President, traditional or cultural leaders, and properties used exclusively for public worship or charitable purposes are typically exempt. However, standard owner-occupied residential properties are generally subject to rates determined by the local municipal or city council.",
    speaker: "ai",
  },
  { status: "idle", duration: 999999 }, // Stay idle after simulation
];

const VoicePage = () => {
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([
    {
      id: "init",
      speaker: "system",
      text: "Call connected. WebSocket server bridge ready.",
      timestamp: new Date(),
    },
  ]);

  // Format duration SS to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulation orchestrator
  useEffect(() => {
    let currentStep = 0;
    let timeout: NodeJS.Timeout;

    const runStep = () => {
      if (currentStep >= mockSimulationFlow.length) return;

      const step = mockSimulationFlow[currentStep];
      setStatus(step.status as CallStatus);

      if (step.transcript) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${currentStep}`,
            speaker: step.speaker as Speaker,
            text: step.transcript as string,
            timestamp: new Date(),
          },
        ]);
      }

      timeout = setTimeout(() => {
        currentStep++;
        runStep();
      }, step.duration);
    };

    // Start simulation after 2 seconds
    timeout = setTimeout(() => runStep(), 2000);

    return () => clearTimeout(timeout);
  }, []);

  const handleEndCall = () => {
    setStatus("idle");
    setTranscripts((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-end`,
        speaker: "system",
        text: "Call ended by user.",
        timestamp: new Date(),
      },
    ]);
  };

  // Get dynamic colors based on status
  const getVisualizerColors = () => {
    switch (status) {
      case "listening":
        return "from-amber-400 to-orange-500 border-orange-500/50 shadow-orange-500/30";
      case "processing":
        return "from-slate-400 to-slate-500 border-slate-500/50 shadow-slate-500/30";
      case "speaking":
        return "from-indigo-500 to-purple-600 border-indigo-500/50 shadow-indigo-500/30";
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
        return "Connected & Idle";
    }
  };

  const currentSpeaker = [...transcripts]
    .reverse()
    .find((t) => t.speaker !== "system");

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
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status !== "idle" ? "bg-green-400" : "bg-slate-400"}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${status !== "idle" ? "bg-green-500" : "bg-slate-500"}`}
            ></span>
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
            <Radio size={14} /> LIVE
          </span>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-5 py-2 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm font-mono text-lg font-bold text-slate-800 dark:text-white truncate min-w-[100px] text-center">
          {formatTime(duration)}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pt-16 pb-64 lg:pb-72 pointer-events-none">
        <div className="flex flex-col items-center justify-center mb-6 pointer-events-auto text-center px-4">
          <h2
            className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${status === "listening" ? "text-orange-600 dark:text-orange-400" : status === "speaking" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-white"}`}
          >
            {getStatusText()}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 h-5">
            {status === "speaking"
              ? "AI is generating a response"
              : status === "listening"
                ? "Speak clearly into your microphone"
                : ""}
          </p>
        </div>

        {/* Animated Rings Container */}
        <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center pointer-events-auto">
          {/* Ring 3 (Outer) */}
          <div
            className={`absolute inset-0 rounded-full border-[1.5px] border-dashed transition-all duration-[2000ms] ${getVisualizerColors()} ${status === "listening" || status === "speaking" ? "animate-[spin_8s_linear_infinite] scale-150 opacity-20" : "scale-100 opacity-5"}`}
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
            className={`relative z-10 w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-linear-to-br flex items-center justify-center shadow-lg transition-all duration-500 ${getVisualizerColors()} ${status === "idle" ? "grayscale opacity-80" : "saturate-150"}`}
          >
            {status === "processing" ? (
              <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-spin" />
            ) : status === "speaking" ? (
              <BrainCircuit className="w-12 h-12 sm:w-14 sm:h-14 text-white animate-pulse" />
            ) : status === "listening" ? (
              <div className="flex gap-1 items-center justify-center h-10">
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-6" />
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.1s] h-10" />
                <div className="w-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.2s] h-8" />
                <div className="w-1.5 bg-white rounded-full animate-bounce h-5" />
              </div>
            ) : (
              <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-500" />
            )}
          </div>
        </div>
      </div>

      {/* Live Speaker Focus Panel */}
      <div className="absolute bottom-28 left-0 w-full px-4 sm:px-8 flex justify-center z-10 pointer-events-none">
        <div className="w-full max-w-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-[16rem] transition-all pointer-events-auto">
          <div className="flex-1 p-6 sm:p-10 flex items-center justify-center relative">
            {status === "processing" ? (
              <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner mb-6">
                  <BrainCircuit size={32} strokeWidth={1.5} />
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
            ) : currentSpeaker ? (
              <div className="flex flex-col items-center text-center max-w-2xl w-full animate-in slide-in-from-bottom-4 duration-500">
                <div
                  className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg mb-4 transition-all duration-300 ${
                    currentSpeaker.speaker === "ai"
                      ? "bg-linear-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30"
                      : "bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-orange-500/30"
                  }`}
                >
                  {currentSpeaker.speaker === "ai" ? (
                    <BrainCircuit size={24} className="sm:w-7 sm:h-7" />
                  ) : (
                    <UserIcon size={24} className="sm:w-7 sm:h-7" />
                  )}
                </div>
                <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 sm:mb-4">
                  {currentSpeaker.speaker === "ai"
                    ? "Legal Adviser"
                    : user?.name || "You"}
                </h4>
                <p
                  className={`text-lg sm:text-2xl font-medium leading-relaxed sm:leading-loose ${
                    currentSpeaker.speaker === "ai"
                      ? "text-slate-800 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  &quot;{currentSpeaker.text}&quot;
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center opacity-40">
                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Mic size={28} className="text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                  Awaiting Speech...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Call Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-4 sm:gap-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-4 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          {/* Toggle Mic */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-md ${isMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110"}`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-300 hover:scale-110 shadow-lg shadow-red-500/30 hover:rotate-[135deg]"
            title="End Call"
          >
            <PhoneOff size={28} />
          </button>

          {/* Toggle Audio */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-md ${isAudioMuted ? "bg-slate-200 dark:bg-slate-800 text-slate-500" : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:scale-110"}`}
            title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isAudioMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoicePage;
