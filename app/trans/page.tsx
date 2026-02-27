"use client";

/**
 * /app/trans/page.tsx
 *
 * Dual-engine speech-to-text page:
 *  - Chrome / Edge / Safari → react-speech-recognition (native Web Speech API)
 *  - Firefox / unsupported → useAssemblyAITranscription (AssemblyAI streaming)
 *
 * No polyfill is applied. Both engines are given the same UI layout so the
 * user experience is identical regardless of which engine is active.
 */

import { useEffect, useState, useCallback } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useAssemblyAITranscription } from "@/hooks";

// ─── Shared UI ─────────────────────────────────────────────────────────────────

interface DictaphoneUIProps {
  transcript: string;
  listening: boolean;
  engine: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
  error?: string | null;
}

function DictaphoneUI({
  transcript,
  listening,
  engine,
  onStart,
  onStop,
  onReset,
  disabled = false,
  error = null,
}: DictaphoneUIProps) {
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <p className="text-xs font-medium text-gray-400">
        Engine: <span className="text-blue-400">{engine}</span> · Microphone:{" "}
        <span className={listening ? "text-green-400" : "text-gray-400"}>
          {listening ? "on" : "off"}
        </span>
      </p>

      <div className="flex gap-2">
        {!listening ? (
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={onStart}
            disabled={disabled}
          >
            {disabled ? "Connecting…" : "Start"}
          </button>
        ) : (
          <button
            className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
            onClick={onStop}
          >
            Stop
          </button>
        )}

        <button
          className="px-4 py-2 rounded bg-gray-600 text-white disabled:opacity-50"
          onClick={onReset}
          disabled={disabled}
        >
          Reset
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <p className="text-white min-h-8">
        {transcript || <span className="text-gray-500">Start speaking…</span>}
      </p>
    </div>
  );
}

// ─── Native engine (Chrome / Edge / Safari) ───────────────────────────────────

function NativeDictaphone() {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn&apos;t support speech recognition.</span>;
  }

  if (!isMicrophoneAvailable) {
    return <span>Microphone not available.</span>;
  }

  return (
    <DictaphoneUI
      transcript={transcript}
      listening={listening}
      engine="native (Web Speech API)"
      onStart={() =>
        SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        })
      }
      onStop={() => SpeechRecognition.stopListening()}
      onReset={() => {
        SpeechRecognition.stopListening();
        resetTranscript();
      }}
    />
  );
}

// ─── AssemblyAI engine (Firefox / unsupported browsers) ──────────────────────

function AssemblyAIDictaphone() {
  const { transcript, isRecording, isConnecting, error, start, stop, reset } =
    useAssemblyAITranscription();

  const handleReset = useCallback(async () => {
    await stop();
    reset();
  }, [stop, reset]);
  console.log("transcript", transcript);
  return (
    <DictaphoneUI
      transcript={transcript}
      listening={isRecording}
      engine="AssemblyAI (streaming)"
      onStart={start}
      onStop={stop}
      onReset={handleReset}
      disabled={isConnecting}
      error={error?.message ?? null}
    />
  );
}

// ─── Root — picks engine at runtime ──────────────────────────────────────────

export default function TransPage() {
  // Detect native support once after hydration (avoids SSR mismatch)
  const [hasNative, setHasNative] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasNative(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
  }, []);

  // Still hydrating — render nothing to avoid a flash of wrong content
  if (hasNative === null) return null;

  return hasNative ? <NativeDictaphone /> : <AssemblyAIDictaphone />;
}
