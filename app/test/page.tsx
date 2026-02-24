"use client";

import { useState, useCallback } from "react";
import { useVoiceSession, useTranscription } from "@/hooks";

export default function TranscriberDemo() {
  const [llmText, setLlmText] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  // ── Voice session (WebSocket + audio) ────────────────────────────────────────
  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    onText: (delta) => setLlmText((prev) => prev + delta),
    onInterrupt: () => {
      setLlmText("");
      setIsResponding(false);
    },
    onAudioDone: () => setIsResponding(false),
    onError: (msg) => {
      setServerError(msg);
      setIsResponding(false);
    },
  });

  // ── Transcription (STT) ───────────────────────────────────────────────────────
  const handleTurnEnd = useCallback(
    (text: string) => {
      setLlmText("");
      setIsResponding(true);
      send(text);
    },
    [send],
  );

  const {
    transcript,
    isRecording,
    isConnecting: isSttConnecting,
    error: transcriptError,
    start: startStt,
    stop: stopStt,
    reset: resetStt,
  } = useTranscription({
    onTurnEnd: handleTurnEnd,
    onError: (err) => console.error("[stt]", err),
  });

  // ── Controls ──────────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    connect();
    await startStt();
  }, [connect, startStt]);

  const handleStop = useCallback(async () => {
    await stopStt();
    disconnect();
    setIsResponding(false);
  }, [stopStt, disconnect]);

  const handleReset = useCallback(async () => {
    await handleStop();
    resetStt();
    setLlmText("");
    setServerError(null);
  }, [handleStop, resetStt]);

  // ── UI ────────────────────────────────────────────────────────────────────────
  // "Fully connected" = WebSocket open AND mic + AssemblyAI recording.
  // Both must be ready before we show the active/Stop state.
  const isFullyConnected = wsStatus === "open" && isRecording;
  const isAnyConnecting =
    wsStatus === "connecting" || (wsStatus === "open" && isSttConnecting);

  const sessionLabel = isFullyConnected
    ? "open"
    : isAnyConnecting
      ? "connecting"
      : wsStatus;

  const wsColor = isFullyConnected
    ? "text-green-500"
    : isAnyConnecting
      ? "text-yellow-400"
      : "text-gray-400";

  const audioColor =
    audioStatus === "playing"
      ? "text-green-500"
      : audioStatus === "done"
        ? "text-blue-400"
        : "text-gray-400";

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={isFullyConnected ? handleStop : handleStart}
          disabled={isAnyConnecting}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {isAnyConnecting
            ? "Connecting…"
            : isFullyConnected
              ? "Stop"
              : "Start"}
        </button>

        <button
          onClick={handleReset}
          disabled={isAnyConnecting}
          className="px-4 py-2 rounded bg-gray-200 disabled:opacity-50 text-black"
        >
          Reset
        </button>

        <span className="ml-auto text-xs flex gap-3 text-gray-300">
          <span>
            Session: <span className={wsColor}>{sessionLabel}</span>
          </span>
          <span>
            Audio: <span className={audioColor}>{audioStatus}</span>
          </span>
          {isResponding && (
            <span className="text-blue-400 animate-pulse">responding…</span>
          )}
        </span>
      </div>

      {/* Errors */}
      {transcriptError && (
        <p className="text-red-500 text-sm">STT: {transcriptError.message}</p>
      )}
      {serverError && (
        <p className="text-red-500 text-sm">Server: {serverError}</p>
      )}

      {/* Transcript */}
      <div>
        <p className="text-xs font-medium mb-1 text-gray-100">You</p>
        <div className="min-h-20 p-4 border rounded bg-gray-50 text-sm leading-relaxed text-black">
          {transcript || <span className="text-gray-400">Start speaking…</span>}
        </div>
      </div>

      {/* LLM response */}
      <div>
        <p className="text-xs font-medium mb-1 text-gray-100">Assistant</p>
        <div className="min-h-20 p-4 border rounded bg-gray-50 text-sm leading-relaxed text-black">
          {llmText || (
            <span className="text-gray-400">
              {isResponding ? "Thinking…" : "Response will appear here…"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
