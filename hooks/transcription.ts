"use client";

import { useRef, useState, useCallback } from "react";
import { StreamingTranscriber } from "assemblyai";

// ─── Types ────────────────────────────────────────────────────────────────────

type Encoding = "pcm_s16le" | "pcm_mulaw";

type StreamingTranscriberOptions = ConstructorParameters<
  typeof StreamingTranscriber
>[0];

export interface UseTranscriptionOptions {
  /** API route that returns `{ token: string }`. Default: '/api/assemblyai-token' */
  tokenEndpoint?: string;
  /** Audio sample rate in Hz. Default: 16000 */
  sampleRate?: number;
  /** AssemblyAI PCM encoding format. Default: 'pcm_s16le' */
  encoding?: Encoding;
  /**
   * How many PCM samples to accumulate before sending to AssemblyAI.
   * At 16kHz, 2048 ≈ 128ms, 4096 ≈ 256ms. AssemblyAI recommends ~50ms
   * chunks minimum, so don't go below ~800 samples.
   * Default: 2048
   */
  chunkSize?: number;
  /**
   * Whether AssemblyAI should return punctuated, cased, formatted text
   * after end-of-turn is detected. Adds a slight delay but improves readability.
   * Default: true
   */
  formatTurns?: boolean;
  /**
   * Called when the user finishes a speaking turn, with the final
   * (optionally formatted) transcript text for that turn only.
   * Use this to forward completed utterances to an LLM or downstream service.
   */
  onTurnEnd?: (turnText: string) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

export interface UseTranscriptionReturn {
  /** Accumulated transcript — updates in real time as words are finalised */
  transcript: string;
  /** True while the mic and AudioWorklet are active */
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
  chunkSize: 2048,
  formatTurns: true,
  onTurnEnd: () => {},
  onError: () => {},
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAssemblyAITranscription = (
  options: UseTranscriptionOptions = {},
): UseTranscriptionReturn => {
  const config: Required<UseTranscriptionOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [transcript, setTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const transcriberRef = useRef<StreamingTranscriber | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const committedRef = useRef<string>("");

  const handleError = useCallback(
    (err: unknown) => {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      config.onError(wrapped);
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

      // 2. Set up the AssemblyAI StreamingTranscriber
      const transcriberOptions: StreamingTranscriberOptions = {
        token,
        sampleRate: config.sampleRate,
        encoding: config.encoding,
        formatTurns: config.formatTurns,
      };

      const transcriber = new StreamingTranscriber(transcriberOptions);

      transcriber.on("open", () => {
        isConnectedRef.current = true;
      });

      transcriber.on(
        "turn",
        (turn: {
          transcript: string;
          end_of_turn: boolean;
          turn_is_formatted: boolean;
        }) => {
          if (!turn.transcript) return;
          // Skip the raw end_of_turn message when waiting for the formatted version
          if (config.formatTurns && turn.end_of_turn && !turn.turn_is_formatted)
            return;

          const committed = committedRef.current;
          const updated = committed
            ? `${committed} ${turn.transcript}`
            : turn.transcript;
          setTranscript(updated);

          if (turn.end_of_turn) {
            committedRef.current = updated;
            config.onTurnEnd(turn.transcript);
            // setTranscript(turn.transcript);
          }
        },
      );

      transcriber.on("error", (err: Error) => handleError(err));
      transcriber.on("close", () => {
        isConnectedRef.current = false;
      });

      await transcriber.connect();
      transcriberRef.current = transcriber;

      // 3. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 4. Create AudioContext at the target sample rate
      //    This avoids resampling artifacts — the browser will downsample
      //    from the mic's native rate to sampleRate for us.
      const audioContext = new AudioContext({ sampleRate: config.sampleRate });
      audioContextRef.current = audioContext;

      // 5. Load the AudioWorklet processor from /public
      await audioContext.audioWorklet.addModule("/pcm-processor.js");

      // 6. Wire up: mic → source node → worklet → AssemblyAI
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor", {
        processorOptions: { chunkSize: config.chunkSize },
      });
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event: MessageEvent<Int16Array>) => {
        if (!isConnectedRef.current || !transcriberRef.current) return;
        try {
          // Int16Array shares the underlying ArrayBuffer — send it directly
          transcriberRef.current.sendAudio(event.data.buffer);
        } catch {
          // Socket closed between the isConnectedRef check and send — safe to ignore
        }
      };

      sourceNode.connect(workletNode);
      // Connect to destination with zero gain so no audio plays back through speakers.
      // The connection is required — a disconnected worklet node may be garbage collected.
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      handleError(err);
    } finally {
      setIsConnecting(false);
    }
  }, [isRecording, isConnecting, config, handleError]);

  const stop = useCallback(async (): Promise<void> => {
    if (!isRecording) return;

    // Disconnect and clean up the audio graph
    workletNodeRef.current?.port.close();
    sourceNodeRef.current?.disconnect();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    sourceNodeRef.current = null;

    await audioContextRef.current?.close();
    audioContextRef.current = null;

    // Release the microphone
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    // Close AssemblyAI WebSocket
    await transcriberRef.current?.close();
    transcriberRef.current = null;
    isConnectedRef.current = false;

    setIsRecording(false);
  }, [isRecording]);

  const reset = useCallback((): void => {
    if (isRecording) stop();
    committedRef.current = "";
    setTranscript("");
    setError(null);
  }, [isRecording, stop]);

  return {
    transcript,
    isRecording,
    isConnecting,
    error,
    start,
    stop,
    reset,
  };
};
