"use client";

import { useRef, useState, useCallback } from "react";
import { RealtimeTranscriber, RealtimeTranscript } from "assemblyai";
import RecordRTC from "recordrtc";

// ─── Types ────────────────────────────────────────────────────────────────────

type Encoding = "pcm_s16le" | "pcm_mulaw";

export interface UseTranscriptionOptions {
  /** API route that returns `{ token: string }`. Default: '/api/assemblyai-token' */
  tokenEndpoint?: string;
  /** Audio sample rate in Hz. Default: 16000 */
  sampleRate?: number;
  /** AssemblyAI PCM encoding format. Default: 'pcm_s16le' */
  encoding?: Encoding;
  /** How often (ms) audio chunks are sent to AssemblyAI. Default: 250 */
  chunkInterval?: number;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

export interface UseTranscriptionReturn {
  /** Accumulated final transcript text */
  transcript: string;
  /** In-progress partial result — updates in real time as you speak */
  partialTranscript: string;
  /** True while the mic and WebSocket are active */
  isRecording: boolean;
  /** True during the async connection/setup phase */
  isConnecting: boolean;
  /** Any error that occurred during setup or transcription */
  error: Error | null;
  /** Connects to AssemblyAI and starts recording */
  start: () => Promise<void>;
  /** Gracefully stops recording and closes all connections */
  stop: () => Promise<void>;
  /** Stops recording and clears all transcript state */
  reset: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<UseTranscriptionOptions> = {
  tokenEndpoint: "/api/assemblyai-token",
  sampleRate: 16000,
  encoding: "pcm_s16le",
  chunkInterval: 250,
  onError: () => {},
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranscription(
  options: UseTranscriptionOptions = {},
): UseTranscriptionReturn {
  const config: Required<UseTranscriptionOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [transcript, setTranscript] = useState<string>("");
  const [partialTranscript, setPartialTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const recorderRef = useRef<InstanceType<typeof RecordRTC> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  const handleError = useCallback(
    (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      config.onError(error);
    },
    [config],
  );

  const start = useCallback(async (): Promise<void> => {
    if (isRecording || isConnecting) return;

    setError(null);
    setIsConnecting(true);

    try {
      // 1. Fetch a short-lived token from your Next.js API route
      const res = await fetch(config.tokenEndpoint);
      if (!res.ok) throw new Error(`Token fetch failed: ${res.statusText}`);

      const { token } = (await res.json()) as { token: string };

      // 2. Set up AssemblyAI real-time transcriber
      const transcriber = new RealtimeTranscriber({
        token,
        sampleRate: config.sampleRate,
        encoding: config.encoding,
      });

      // Handle partial + final transcripts (SDK emits a unified 'transcript' event)
      transcriber.on("transcript", (t: RealtimeTranscript) => {
        if (!t.text) return;

        if (t.message_type === "PartialTranscript") {
          setPartialTranscript(t.text);
        } else if (t.message_type === "FinalTranscript") {
          setTranscript((prev) => (prev ? `${prev} ${t.text}` : t.text));
          setPartialTranscript("");
        }
      });

      transcriber.on("error", (err: Error) => handleError(err));

      transcriber.on("open", () => {
        isConnectedRef.current = true;
      });

      await transcriber.connect();
      transcriberRef.current = transcriber;

      // 3. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 4. Dynamically import RecordRTC to avoid SSR issues in Next.js
      const { default: RecordRTC, StereoAudioRecorder } =
        await import("recordrtc");

      const recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: StereoAudioRecorder, // Web Audio API path — works on Safari
        sampleRate: config.sampleRate,
        desiredSampRate: config.sampleRate,
        numberOfAudioChannels: 1,
        timeSlice: config.chunkInterval,
        ondataavailable: async (blob: Blob) => {
          if (blob.size > 0 && isConnectedRef.current) {
            const buffer = await blob.arrayBuffer();
            transcriberRef.current!.sendAudio(buffer);
          }
        },
      });

      recorder.startRecording();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      handleError(err);
    } finally {
      setIsConnecting(false);
    }
  }, [isRecording, isConnecting, config, handleError]);

  const stop = useCallback(async (): Promise<void> => {
    if (!isRecording) return;

    // Stop RecordRTC and wait for the callback before continuing
    await new Promise<void>((resolve) => {
      recorderRef.current?.stopRecording(() => {
        recorderRef.current?.destroy();
        recorderRef.current = null;
        resolve();
      });
    });

    // Release microphone — clears the browser recording indicator
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    // Close AssemblyAI WebSocket connection
    await transcriberRef.current?.close();
    transcriberRef.current = null;
    isConnectedRef.current = false;

    setPartialTranscript("");
    setIsRecording(false);
  }, [isRecording]);

  const reset = useCallback((): void => {
    if (isRecording) stop();
    setTranscript("");
    setPartialTranscript("");
    setError(null);
  }, [isRecording, stop]);

  return {
    transcript,
    partialTranscript,
    isRecording,
    isConnecting,
    error,
    start,
    stop,
    reset,
  };
}
