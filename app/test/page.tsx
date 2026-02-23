"use client";

import { useRef, useState } from "react";
import {
  useTranscription,
  useWebSocket,
  type WsInbound,
  useAudioStream,
  WebSocketStatus,
} from "@/hooks";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export default function TranscriberDemo() {
  const [llmText, setLlmText] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const [status, setStatus] = useState<WebSocketStatus>("idle");

  // ── Audio stream ─────────────────────────────────────────────────────────────

  const {
    status: audioStatus,
    bufferHealth,
    init: initAudio,
    pushChunk,
    flush: flushAudio,
    resume: resumeAudio,
    destroy: destroyAudio,
  } = useAudioStream({
    encoding: "int16",
    onDrained: () => setIsResponding(false),
    onUnderrun: () => console.warn("[audio] buffer underrun"),
    onError: (e) => console.error("[audio]", e),
  });

  const audioReadyRef = useRef(false);

  // ── WebSocket ─────────────────────────────────────────────────────────────────

  const {
    status: wsStatus,
    send,
    connect,
    disconnect,
  } = useWebSocket({
    onMessage: (data: WsInbound) => {
      console.log("server response", data);
      if (data instanceof ArrayBuffer) {
        pushChunk(data);
        return;
      }

      if (data.startsWith("READY:")) {
        const sampleRate = Number(data.slice(6));
        console.log(`[ws] ready — sample rate: ${sampleRate}Hz`);
        if (!audioReadyRef.current) {
          audioReadyRef.current = true;
          initAudio(sampleRate).catch(console.error);
        }
        return;
      }

      if (data.startsWith("TEXT:")) {
        setLlmText((prev) => prev + data.slice(5));
        return;
      }

      if (data === "INTERRUPT") {
        flushAudio();
        setLlmText("");
        setIsResponding(false);
        return;
      }

      if (data === "DONE") {
        console.log("[ws] DONE");
        return;
      }

      if (data.startsWith("ERROR:")) {
        setServerError(data.slice(6).trim());
        setIsResponding(false);
        return;
      }
    },
    onClose: () => {
      audioReadyRef.current = false;
    },
    onError: (e) => console.error("[ws]", e),
    reconnect: false, // manual control — user presses Start/Stop
  });

  // ── Transcription ─────────────────────────────────────────────────────────────

  const handleTurnEnd = (turnText: string) => {
    console.log("status", status);
    // if (wsStatus !== "open") return;
    console.log("turnText", turnText);
    // flushAudio();
    setLlmText("");
    // setServerError(null);
    setIsResponding(true);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(turnText);
    }
  };

  const {
    transcript,
    isRecording,
    isConnecting,
    error: transcriptError,
    start: startStt,
    stop: stopStt,
    reset: resetStt,
  } = useTranscription({
    onTurnEnd: handleTurnEnd,
    onError: (err) => console.error("[stt]", err),
  });

  // ── Start: open WS + start STT ────────────────────────────────────────────────

  const handleStart = async () => {
    setLlmText("");
    setServerError(null);

    // AudioContext must be created inside a user gesture (autoplay policy).
    // We init with a provisional rate here; READY:<rate> will re-init if needed.
    if (!audioReadyRef.current) {
      await initAudio(48000);
      await resumeAudio();
    }

    connect(WS_URL);
    startStt();
  };

  // ── Stop: stop STT + close WS ─────────────────────────────────────────────────

  const handleStop = async () => {
    stopStt();
    flushAudio();
    disconnect();
    await destroyAudio();
    audioReadyRef.current = false;
    setIsResponding(false);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const handleReset = async () => {
    await handleStop();
    resetStt();
    setLlmText("");
    setServerError(null);
  };

  const connectWs = () => {
    const socket = new WebSocket("ws://localhost:3001");
    socket.binaryType = "arraybuffer";

    // let promptSentTime = 0;
    // let waitingForFirstByte = false;
    socketRef.current = socket;
    setStatus("connecting");
    socket.onopen = async () => {
      console.log("ws opened");
      // stopStt();
      // flushAudio();
      await startStt();
      setStatus("open");
    };
    socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      // console.log("Server response:", event.data);

      if (event.data instanceof ArrayBuffer) {
        // if (waitingForFirstByte) {
        // const latency = (performance.now() - promptSentTime).toFixed(1);
        // latencyEl.innerText = `TTFB: ${latency}ms`;
        // latencyEl.classList.remove("waiting");
        //   waitingForFirstByte = false;
        // }
        schedulePlayback(event.data);
        return;
      }

      if (typeof event.data === "string") {
        if (event.data === "INTERRUPT") {
          console.log("Interruption signal received from server");
          if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
          }
          nextStartTimeRef.current = 0;
          // txEl.innerText = "";
          // txEl.classList.remove("active");
          // statusText.innerText = "Interrupted...";
          return;
        }

        if (event.data.startsWith("TEXT:")) {
          const delta = event.data.substring(5);
          console.log("transcript", delta);
          setLlmText((prev) => prev + delta);
          // txEl.classList.add("active");
          // txEl.innerText += delta;
          // txEl.scrollTop = txEl.scrollHeight;
          return;
        }

        if (event.data.startsWith("READY")) {
          const rate = parseInt(event.data.split(":")[1], 10);
          // if (!isNaN(rate)) sampleRate = rate;
          // statusText.innerText = "Online";
          return;
        }

        if (event.data === "DONE") {
          console.log("Audio stream end");
          // statusText.innerText = "Online";
          // statusDot.classList.remove("busy");
          // btn.disabled = false;
          return;
        }

        if (event.data.startsWith("ERROR:")) {
          console.error(event.data);
          // statusText.innerText = "Error";
          // statusDot.classList.add("offline");
          // btn.disabled = false;
        }
      }
    };
    socket.onerror = (event: Event) => {
      console.error("ws error", event);
      setStatus("error");
    };
    socket.onclose = (event: CloseEvent) => {
      console.log("ws closed", event);
      setStatus("closed");
    };
  };

  function schedulePlayback(arrayBuffer: ArrayBuffer) {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }

    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    // Apply tiny fade in/out (5ms)
    const fadeSamples = Math.min(240, float32.length / 2); // ~5ms at 48k
    for (let i = 0; i < fadeSamples; i++) {
      float32[i] *= i / fadeSamples;
      float32[float32.length - 1 - i] *= i / fadeSamples;
    }

    const buffer = audioCtxRef.current.createBuffer(
      1,
      float32.length,
      audioCtxRef.current.sampleRate,
    );

    buffer.copyToChannel(float32, 0);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);

    const currentTime = audioCtxRef.current.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  }

  const disconnectWs = async () => {
    socketRef.current?.close();
    await stopStt();
    // flushAudio();
    // disconnect();
    await destroyAudio();
    audioReadyRef.current = false;
    setIsResponding(false);
  };

  // ── UI ────────────────────────────────────────────────────────────────────────

  // const bufferPercent = Math.round(bufferHealth * 100);

  const wsColor =
    status === "open"
      ? "text-green-500"
      : status === "connecting"
        ? "text-yellow-400"
        : "text-gray-400";

  const audioColor =
    audioStatus === "playing"
      ? "text-green-500"
      : audioStatus === "buffering"
        ? "text-yellow-400"
        : "text-gray-400";

  const isActive = status === "open";
  // console.log("status", status);
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={isActive ? disconnectWs : connectWs}
          disabled={status === "connecting"}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {status === "connecting"
            ? "Connecting…"
            : isActive
              ? "Stop"
              : "Start"}
        </button>

        <button
          onClick={handleReset}
          disabled={status === "connecting"}
          className="px-4 py-2 rounded bg-gray-200 disabled:opacity-50 text-black"
        >
          Reset
        </button>

        <span className="ml-auto text-xs flex gap-3 text-gray-300">
          <span>
            WS: <span className={wsColor}>{status}</span>
          </span>
          <span>
            Audio: <span className={audioColor}>{status}</span>
          </span>
          {isResponding && (
            <span className="text-blue-400 animate-pulse">responding…</span>
          )}
        </span>
      </div>

      {/* Buffer health bar */}
      {/* {(audioStatus === "playing" || wsStatus === "buffering") && (
        <div className="space-y-1">
          <p className="text-xs text-black">
            Audio buffer: {bufferPercent}%
            {audioStatus === "buffering" && " (buffering…)"}
          </p>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden text-black">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                audioStatus === "buffering" ? "bg-yellow-400" : "bg-green-500"
              }`}
              style={{ width: `${bufferPercent}%` }}
            />
          </div>
        </div>
      )} */}

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
          {transcript || <span className="text-black">Start speaking…</span>}
        </div>
      </div>

      {/* LLM response */}
      <div>
        <p className="text-xs font-medium mb-1 text-gray-100">Assistant</p>
        <div className="min-h-20 p-4 border rounded bg-gray-50 text-sm leading-relaxed text-black">
          {llmText || (
            <span className="text-black">
              {isResponding ? "Thinking…" : "Response will appear here…"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
