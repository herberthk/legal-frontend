"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranscription, useWebSocket } from "@/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of messages your LLM server sends back
interface LLMResponse {
  reply: string;
}

// Shape of messages you send to your LLM server
interface LLMRequest {
  text: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TranscriberDemo() {
  const [llmReply, setLlmReply] = useState<string>("");

  // 1. WebSocket connection to your LLM inference server
  const {
    status: wsStatus,
    send,
    connect,
    disconnect,
  } = useWebSocket<LLMResponse, LLMRequest>({
    onMessage: (data) => setLlmReply(data.reply),
    onError: (e) => console.error("WebSocket error:", e),
    reconnect: true,
    reconnectDelay: 2000,
  });

  // Open the WebSocket when the component mounts
  //   useEffect(() => {
  //     connect("ws://localhost:8000/inference"); // replace with your server URL
  //     return () => disconnect();
  //   }, [connect, disconnect]);

  // 2. Forward completed turns to the LLM server
  const handleTurnEnd = useCallback(
    (turnText: string) => {
      if (wsStatus !== "open") {
        console.warn("WebSocket not open — dropping turn:", turnText);
        return;
      }
      send({ text: turnText });
    },
    [wsStatus, send],
  );

  // 3. Transcription
  const { transcript, isRecording, isConnecting, error, start, stop, reset } =
    useTranscription({
      onTurnEnd: handleTurnEnd,
      onError: (err) => console.error("Transcription error:", err),
    });

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={isRecording ? stop : start}
          disabled={isConnecting}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {isConnecting ? "Connecting..." : isRecording ? "Stop" : "Start"}
        </button>

        <button
          onClick={reset}
          disabled={isConnecting}
          className="px-4 py-2 rounded bg-gray-200 disabled:opacity-50"
        >
          Reset
        </button>

        <span className="ml-auto text-xs text-gray-400">
          WS:{" "}
          <span
            className={wsStatus === "open" ? "text-green-500" : "text-red-400"}
          >
            {wsStatus}
          </span>
        </span>
      </div>

      {error && <p className="text-red-500 text-sm">{error.message}</p>}

      {/* Transcript */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1">Transcript</p>
        <div className="min-h-24 p-4 border rounded bg-gray-50 text-sm leading-relaxed">
          {transcript || (
            <span className="text-gray-300">
              Transcript will appear here...
            </span>
          )}
        </div>
      </div>

      {/* LLM reply */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-1">LLM Response</p>
        <div className="min-h-24 p-4 border rounded bg-gray-50 text-sm leading-relaxed">
          {llmReply || (
            <span className="text-gray-300">
              LLM response will appear here...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
