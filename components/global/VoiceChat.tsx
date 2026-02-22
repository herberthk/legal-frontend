"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  Phone,
  Activity,
  X,
  User as UserIcon,
  Scale,
  RefreshCw,
  FileText,
  AlertTriangle,
  WifiOff,
  Volume2,
  Save,
  Coins,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LiveVoiceService } from "@/services";
import { formatTime } from "@/lib";
import { useAppStore } from "@/store";

interface VoiceInterfaceProps {
  onClose?: (
    transcripts?: { sender: "user" | "model"; text: string }[],
    recordingBlob?: Blob,
    duration?: number,
  ) => void;
  // Return boolean: true if successful charge, false if insufficient funds
  onTokenUsage: (
    amount: number,
    unit: "TOKENS" | "SECONDS",
    type: "TEXT_PROMPT" | "TEXT_RESPONSE" | "VOICE_SESSION",
  ) => boolean;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onClose,
  onTokenUsage,
}) => {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<
    { sender: "user" | "model"; text: string }[]
  >([]);
  const preferredVoice = useAppStore((state) => state.preferredVoice);
  const [duration, setDuration] = useState(0);
  const [hasAiInteracted, setHasAiInteracted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isContextUpdating, setIsContextUpdating] = useState(false);

  // Error handling state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    type?: "error" | "warning";
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voiceServiceRef = useRef<LiveVoiceService | null>(null);
  const animationRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const usageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: "error" | "warning" = "error") => {
    setToast({ message, visible: true, type });
    setTimeout(
      () => setToast((prev) => (prev ? { ...prev, visible: false } : null)),
      5000,
    );
  };

  const forceDisconnectDueToBilling = () => {
    setErrorDetails(
      "Session ended: Insufficient credits or balance to continue.",
    );
    setShowErrorModal(true);
    if (voiceServiceRef.current) {
      voiceServiceRef.current.disconnect();
    }
    // Stop timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
  };

  useEffect(() => {
    let service: LiveVoiceService | null = null;
    let isMounted = true;

    const connect = async () => {
      // Create local instance
      service = new LiveVoiceService(
        preferredVoice,
        (status) => {
          if (isMounted) {
            setConnectionState(status as ConnectionState);
            if (status === "connected") {
              setShowErrorModal(false);
              setErrorDetails(null);
            }
          }
        },
        (level) => {
          if (isMounted) setAudioLevel(level);
        },
        (sender, text) => {
          if (isMounted) {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.sender === sender) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + text },
                ];
              }
              return [...prev, { sender, text }];
            });
          }
        },
        () => {}, // Usage handled via interval for time.
        (errorMsg) => {
          if (isMounted) {
            console.log("Showing error modal for:", errorMsg);
            setErrorDetails(errorMsg);
            setShowErrorModal(true);
            showToast(errorMsg);
          }
        },
        (isSpeaking) => {
          if (isMounted) setIsUserSpeaking(isSpeaking);
        },
        () => {
          // Context Updated Callback
          if (isMounted) {
            setIsContextUpdating(true);
            setTimeout(() => setIsContextUpdating(false), 3000);
          }
        },
      );

      voiceServiceRef.current = service;

      if (isMounted) {
        await service.connect(); // Initial connection
      } else {
        service.disconnect();
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (service) {
        service.disconnect();
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
    };
  }, []);

  const handleRetry = async () => {
    // Don't retry if it was a billing error
    if (errorDetails?.includes("Insufficient credits")) {
      return;
    }
    setShowErrorModal(false); // Optimistically hide modal
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.connect(true);
    }
  };

  useEffect(() => {
    if (!hasAiInteracted) {
      const aiHasSpoken = transcripts.some((t) => t.sender === "model");
      if (aiHasSpoken) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHasAiInteracted(true);
      }
    }
  }, [transcripts, hasAiInteracted]);

  // Timer Effect & Billing Heartbeat
  useEffect(() => {
    // Only start billing once the call is truly active (AI has responded or we've been connected for > 5s)
    const isActive = connectionState === "connected";

    if (isActive) {
      // Visual duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Billing Heartbeat (Every 2 seconds)
      // REAL-WORLD INTEGRATION HINT: In production, this might call a backend endpoint to lock funds.
      usageIntervalRef.current = setInterval(() => {
        const success = onTokenUsage(2, "SECONDS", "VOICE_SESSION");
        if (!success) {
          forceDisconnectDueToBilling();
        }
      }, 2000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
    };
  }, [connectionState]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Visualizer Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const draw = () => {
      if (!ctx || !canvas) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (connectionState === "connected" && !showErrorModal) {
        // If user is NOT speaking, dampen the visualizer significantly to show "listening" state vs "processing noise"
        const visualMultiplier = isUserSpeaking ? 8 : 1.5;

        const amplifiedLevel = Math.min(1, audioLevel * visualMultiplier);
        const pulseRadius = Math.max(height / 2, amplifiedLevel * height);
        const gradient = ctx.createRadialGradient(
          width / 2,
          centerY,
          0,
          width / 2,
          centerY,
          pulseRadius,
        );

        const hue = 45 - amplifiedLevel * 30;
        gradient.addColorStop(
          0,
          `hsla(${hue}, 100%, 50%, ${0.1 + amplifiedLevel * 0.2})`,
        );
        gradient.addColorStop(1, "hsla(0, 0%, 100%, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const waveCount = 3;
        for (let i = 0; i < waveCount; i++) {
          ctx.beginPath();
          const layerHue = hue + i * 5;
          const lightness = 50 + i * 10;
          const alpha = 0.8 - i * 0.2;
          ctx.strokeStyle = `hsla(${layerHue}, 100%, ${lightness}%, ${alpha})`;
          ctx.lineWidth = 2 + amplifiedLevel * 3;
          ctx.shadowBlur = 4 + amplifiedLevel * 10;
          ctx.shadowColor = `hsla(${layerHue}, 100%, 50%, 0.6)`;

          for (let x = 0; x < width; x++) {
            const normX = (x / width) * 2 - 1;
            const envelope = Math.pow(1 - Math.pow(normX, 2), 2);
            const frequency = 0.01 + i * 0.003 + amplifiedLevel * 0.005;
            const wavePhase = phase * (1 + i * 0.1);
            const baseAmplitude = height * 0.05;
            const dynamicAmplitude = height * 0.4 * amplifiedLevel;
            const signal =
              Math.sin(x * frequency + wavePhase) +
              Math.sin(x * frequency * 2.1 + wavePhase) * 0.5;
            const y =
              centerY + signal * (baseAmplitude + dynamicAmplitude) * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        phase += 0.1 + amplifiedLevel * 0.15;
      } else {
        const time = Date.now() / 1000;
        ctx.beginPath();
        const isDark = true;
        ctx.strokeStyle = isDark ? "#475569" : "#cbd5e1";
        ctx.lineWidth = 2;
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.01 + time) * 3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [connectionState, audioLevel, showErrorModal, isUserSpeaking]);

  const handleDisconnect = async () => {
    // Final billing catch-up not strictly needed since we poll every 2s, but good for accuracy
    // However, if we forced disconnect due to funds, don't charge more.
    if (!showErrorModal) {
      onTokenUsage(duration % 2, "SECONDS", "VOICE_SESSION");
    }

    // Retrieve recording blob if available
    let recordingBlob: Blob | undefined;
    if (voiceServiceRef.current) {
      const result = await voiceServiceRef.current.disconnect();
      console.log("Audio recording blob", result);
      if (result) recordingBlob = result;
    }

    if (onClose) onClose(transcripts, recordingBlob, duration);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && toast.visible && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-70 animate-in slide-in-from-top-4 fade-in duration-300">
          <div
            className={`${
              toast.type === "error"
                ? "bg-red-500/90 border-red-400/50"
                : "bg-orange-500/90 border-orange-400/50"
            } backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border max-w-sm md:max-w-md`}
          >
            <AlertTriangle size={18} className="shrink-0" />
            <span className="text-sm font-medium truncate">
              {toast.message}
            </span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:bg-white/20 rounded-full p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Error Modal Overlay */}
      {showErrorModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center border border-red-100 dark:border-red-900/30 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              {errorDetails?.includes("Insufficient") ? (
                <Coins size={32} />
              ) : (
                <WifiOff size={32} />
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {errorDetails?.includes("Insufficient")
                ? "Out of Credits"
                : "Connection Interrupted"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              {errorDetails ||
                "We lost connection to the Live Service. Please check your internet connection."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDisconnect}
                className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl font-bold shadow-lg transition-all active:scale-95 text-sm"
              >
                Close Session
              </button>
              {!errorDetails?.includes("Insufficient") && (
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw size={16} /> Resume
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-full max-w-4xl mx-auto flex flex-col p-4 md:p-8 relative z-10">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
              <Activity
                className={`text-orange-500 w-6 h-6 ${
                  isUserSpeaking ? "animate-pulse" : ""
                }`}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Voice Counsel</h2>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionState === "connected"
                      ? "bg-green-500"
                      : connectionState === "error"
                        ? "bg-red-500"
                        : "bg-amber-500 animate-pulse"
                  }`}
                ></span>
                <span className="text-sm text-slate-400">
                  {connectionState === "connected"
                    ? hasAiInteracted
                      ? isUserSpeaking
                        ? "Receiving Audio..."
                        : "Listening..."
                      : "Live Session Ready"
                    : connectionState === "error"
                      ? "Connection Error"
                      : "Establishing Secure Line..."}
                </span>
                {connectionState === "connected" && hasAiInteracted && (
                  <span className="text-sm font-mono text-slate-500 border-l border-slate-700 pl-2 ml-2 animate-in fade-in">
                    {formatTime(duration)}
                  </span>
                )}
                {/* Memory Update Indicator */}
                {isContextUpdating && (
                  <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full ml-2 animate-pulse border border-slate-700">
                    <Save size={10} /> Saved
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
          {/* Dynamic VAD Indicator */}
          {connectionState === "connected" && (
            <div
              className={`absolute top-0 transform -translate-y-full mb-4 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                isUserSpeaking
                  ? "bg-green-500/20 border-green-500/50 text-green-400 scale-100 opacity-100"
                  : "bg-slate-800/50 border-slate-700 text-slate-500 scale-95 opacity-50"
              }`}
            >
              {isUserSpeaking ? (
                <span className="flex items-center gap-2">
                  <Mic size={12} className="animate-pulse" /> Detecting Speech
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Volume2 size={12} /> Ambient Mode
                </span>
              )}
            </div>
          )}

          <div className="w-full max-w-2xl h-64 relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={300}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                showErrorModal ? "opacity-30 blur-sm" : "opacity-100"
              }`}
            />
          </div>

          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300 ${
              showErrorModal ? "opacity-30 blur-sm" : "opacity-100"
            }`}
          >
            <div
              className={`w-32 h-32 rounded-full bg-slate-950 border-4 flex items-center justify-center shadow-2xl relative transition-colors duration-300 ${
                isUserSpeaking ? "border-orange-500/50" : "border-slate-800"
              }`}
            >
              <div
                className={`absolute inset-0 rounded-full bg-orange-500/20 blur-xl transition-opacity duration-300 ${
                  isUserSpeaking
                    ? "opacity-100 scale-110"
                    : "opacity-0 scale-100"
                }`}
              ></div>
              <Scale
                size={48}
                className={`transition-colors duration-300 ${
                  isUserSpeaking ? "text-white" : "text-slate-400"
                }`}
              />
            </div>
            <p className="mt-4 text-slate-400 font-medium tracking-wide">
              LEGAL ADVISER
            </p>
            <p className="text-xs text-orange-500 font-mono mt-1 uppercase tracking-widest">
              {preferredVoice}
            </p>
          </div>
        </div>

        <div className="h-48 md:h-64 mt-8 bg-slate-900/50 rounded-2xl border border-white/10 backdrop-blur-md shadow-inner flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} className="text-orange-500" />
              Session Transcript
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              LIVE LOG
            </span>
          </div>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {transcripts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-600">
                <p className="text-sm">
                  Conversation history will appear here...
                </p>
              </div>
            )}
            {transcripts.map((t, i) => {
              const isLast = i === transcripts.length - 1;
              return (
                <div
                  key={i}
                  className="leading-relaxed animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <span
                    className={`inline-block font-bold text-xs uppercase tracking-wider mb-1 mr-2 ${
                      t.sender === "user" ? "text-blue-400" : "text-orange-500"
                    } ${
                      isLast && connectionState === "connected"
                        ? "animate-pulse"
                        : ""
                    }`}
                  >
                    {t.sender === "user" ? "You:" : "AI:"}
                  </span>
                  <div className="text-slate-300 text-sm prose prose-invert prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {t.text}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-center space-x-4">
          {/* Main control buttons - Only show 'End Consultation' if no error modal is overlaying it 
                 Actually, we keep them visible in background but maybe disabled or dimmed */}
          <button
            onClick={handleDisconnect}
            disabled={showErrorModal}
            className={`flex items-center space-x-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-lg shadow-red-900/30 transition-all transform hover:scale-105 active:scale-95 group ${
              showErrorModal ? "opacity-50 blur-sm pointer-events-none" : ""
            }`}
          >
            <Phone
              size={24}
              className="rotate-135 group-hover:rotate-0 transition-transform duration-300"
            />
            <span>End Consultation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
