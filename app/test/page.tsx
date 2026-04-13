"use client";

/**
 * app/test/page.tsx
 *
 * Voice assistant demo with a DUAL STT strategy:
 *  - Chrome / Edge / Safari → react-speech-recognition (native Web Speech API)
 *  - Firefox / unsupported  → useAssemblyAITranscription (AssemblyAI streaming)
 *
 * Both engines feed into the same useVoiceSession (WebSocket → LLM → TTS) so
 * the full assistant experience is identical in every browser.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useVoiceSession, useAssemblyAITranscription } from "@/hooks";

// ─── Shared status bar ────────────────────────────────────────────────────────

interface StatusBarProps {
  wsStatus: string;
  audioStatus: string;
  isResponding: boolean;
  sessionLabel: string;
  wsColor: string;
  audioColor: string;
  duration?: number;
}

function StatusBar({
  audioStatus,
  isResponding,
  sessionLabel,
  wsColor,
  audioColor,
  duration,
}: StatusBarProps) {
  return (
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
      {/*format duration 00:00:00*/}
      {duration && (
        <span className="text-green-500">
          Duration: {new Date(duration * 1000).toISOString().substr(11, 8)}
        </span>
      )}
    </span>
  );
}

// ─── Native-engine inner component (Chrome / Edge / Safari) ──────────────────

function NativeVoicePage() {
  const [llmText, setLlmText] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [usertranscript, setUsertranscript] = useState("");
  const [duration, setDuration] = useState<number>(0);
  const voice: Voice = "Zephyr";
  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url: `ws://localhost:8000?voice=${voice}`,
    onText: (delta) => setLlmText((prev) => prev + delta),
    onInterrupt: () => {
      // setLlmText("");
      setIsResponding(false);
    },
    onAudioDone: () => setIsResponding(false),
    onError: (msg) => {
      setServerError(msg);
      setIsResponding(false);
    },
    onDuration: (duration) => {
      setDuration(duration);
      // console.log(`[voice] duration — ${duration}`);
    },
  });

  const {
    transcript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // Track which finalTranscript value we already sent to avoid double-sending
  const lastSentRef = useRef("");

  // Each time finalTranscript changes (and is non-empty), forward it to the LLM
  useEffect(() => {
    if (
      finalTranscript &&
      finalTranscript !== lastSentRef.current &&
      wsStatus === "open"
    ) {
      lastSentRef.current = finalTranscript;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLlmText("");
      setIsResponding(true);
      send(finalTranscript);
      setUsertranscript(finalTranscript);
      // Reset so the next utterance is detected as a fresh change
      resetTranscript();
      lastSentRef.current = "";
    }
  }, [finalTranscript, wsStatus]);

  const handleStart = useCallback(() => {
    connect();
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  }, [connect]);

  const handleStop = useCallback(() => {
    SpeechRecognition.stopListening();
    disconnect();
    setIsResponding(false);
  }, [disconnect]);

  const handleReset = useCallback(() => {
    handleStop();
    resetTranscript();
    lastSentRef.current = "";
    setLlmText("");
    setServerError(null);
  }, [handleStop, resetTranscript]);

  const isFullyConnected = wsStatus === "open" && listening;
  const isAnyConnecting = wsStatus === "connecting";

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

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn&apos;t support speech recognition.</span>;
  }

  if (!isMicrophoneAvailable) {
    return <span>Microphone not available.</span>;
  }
  console.log("wsStatus", wsStatus);
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
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

        <StatusBar
          wsStatus={wsStatus}
          audioStatus={audioStatus}
          isResponding={isResponding}
          sessionLabel={sessionLabel}
          wsColor={wsColor}
          audioColor={audioColor}
          duration={duration}
        />
      </div>

      {serverError && (
        <p className="text-red-500 text-sm">Server: {serverError}</p>
      )}

      <div>
        <p className="text-xs font-medium mb-1 text-gray-100">You</p>
        <div className="min-h-20 p-4 border rounded bg-gray-50 text-sm leading-relaxed text-black">
          {transcript || usertranscript || (
            <span className="text-gray-400">Start speaking…</span>
          )}
        </div>
      </div>

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

// ─── AssemblyAI-engine inner component (Firefox / unsupported) ────────────────

function AssemblyAIVoicePage() {
  const [llmText, setLlmText] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);

  const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
    url: "ws://localhost:8000",
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

  const handleTurnEnd = (text: string) => {
    setLlmText("");
    setIsResponding(true);
    send(text);
  };

  const {
    transcript,
    isRecording,
    isConnecting: isSttConnecting,
    error: transcriptError,
    start: startStt,
    stop: stopStt,
    reset: resetStt,
  } = useAssemblyAITranscription({
    onTurnEnd: handleTurnEnd,
    onError: (err) => console.error("[stt]", err),
  });

  const handleStart = async () => {
    connect();
    await startStt();
  };

  const handleStop = async () => {
    await stopStt();
    disconnect();
    setIsResponding(false);
  };

  const handleReset = async () => {
    await handleStop();
    resetStt();
    setLlmText("");
    setServerError(null);
  };

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

        <StatusBar
          wsStatus={wsStatus}
          audioStatus={audioStatus}
          isResponding={isResponding}
          sessionLabel={sessionLabel}
          wsColor={wsColor}
          audioColor={audioColor}
        />
      </div>

      {transcriptError && (
        <p className="text-red-500 text-sm">STT: {transcriptError.message}</p>
      )}
      {serverError && (
        <p className="text-red-500 text-sm">Server: {serverError}</p>
      )}

      <div>
        <p className="text-xs font-medium mb-1 text-gray-100">You</p>
        <div className="min-h-20 p-4 border rounded bg-gray-50 text-sm leading-relaxed text-black">
          {transcript || <span className="text-gray-400">Start speaking…</span>}
        </div>
      </div>

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

// ─── Root — picks engine at runtime ──────────────────────────────────────────

export default function TranscriberDemo() {
  const [hasNative, setHasNative] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasNative(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
  }, []);

  // Avoid SSR / hydration mismatch — render nothing until detection completes
  if (hasNative === null) return null;

  return hasNative ? <NativeVoicePage /> : <AssemblyAIVoicePage />;
}
