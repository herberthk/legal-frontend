"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioStreamStatus =
  | "idle" // not initialised
  | "loading" // AudioContext + worklet module loading
  | "ready" // ready, waiting for audio data
  | "buffering" // receiving chunks, below start threshold
  | "playing" // actively playing audio
  | "drained" // buffer emptied after playing (utterance complete)
  | "error";

export interface UseAudioStreamOptions {
  /**
   * Ring buffer size in samples inside the worklet.
   * At 48kHz: 96000 ≈ 2s (default), 192000 ≈ 4s.
   * Larger = more resilient to network jitter. Smaller = lower latency.
   */
  bufferSize?: number;
  /**
   * How many samples to accumulate before beginning playback.
   * Inworld TTS sends ≥960-sample (20ms) chunks, so the very first chunk
   * exceeds this threshold and playback starts immediately.
   * Default: 480 (10ms @ 48kHz)
   */
  startThreshold?: number;
  /**
   * Bit depth of raw PCM chunks received from the server.
   * Inworld TTS streams LINEAR16 (Int16 little-endian).
   * Default: 'int16'
   */
  encoding?: "int16" | "float32";
  /** Called when the buffer drains cleanly after playing (utterance finished) */
  onDrained?: () => void;
  /** Called when the buffer underruns mid-playback (network stall) */
  onUnderrun?: () => void;
  /** Called on any audio error */
  onError?: (error: Error) => void;
}

export interface UseAudioStreamReturn {
  status: AudioStreamStatus;
  /** 0–1 representing how full the ring buffer currently is */
  bufferHealth: number;
  /**
   * Initialise the AudioContext at the given sample rate.
   * Safe to call from a user-gesture handler (satisfies browser autoplay policy).
   * Idempotent: if already initialised at the same sample rate, returns immediately.
   */
  init: (sampleRate: number) => Promise<void>;
  /**
   * Feed a raw PCM ArrayBuffer received from the WebSocket.
   * No-ops silently if init() hasn't been called yet.
   * Applies a short crossfade on each chunk to prevent click artifacts.
   */
  pushChunk: (buffer: ArrayBuffer) => void;
  /**
   * Clear the ring buffer immediately (interrupt / start of new utterance).
   */
  flush: () => void;
  /** Resume a browser-suspended AudioContext */
  resume: () => Promise<void>;
  /** Fully tear down all resources (call on disconnect / unmount) */
  destroy: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** LINEAR16 → Float32 [-1, 1] conversion (runs on main thread) */
function int16ToFloat32(buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioStream(
  options: UseAudioStreamOptions = {},
): UseAudioStreamReturn {
  const {
    bufferSize = 96000, // 2s at 48kHz
    startThreshold = 480, // 10ms — Inworld chunks are ≥960 samples so this fires immediately
    encoding = "int16",
    onDrained,
    onUnderrun,
    onError,
  } = options;

  const [status, setStatus] = useState<AudioStreamStatus>("idle");
  const [bufferHealth, setBufferHealth] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pendingSamplesRef = useRef<number>(0);
  const playbackStartedRef = useRef<boolean>(false);
  const initSampleRateRef = useRef<number | null>(null);

  // Stable callback refs — updated each render without recreating closures
  const onDrainedRef = useRef(onDrained);
  const onUnderrunRef = useRef(onUnderrun);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onDrainedRef.current = onDrained;
  }, [onDrained]);
  useEffect(() => {
    onUnderrunRef.current = onUnderrun;
  }, [onUnderrun]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ── init ─────────────────────────────────────────────────────────────────────

  const init = useCallback(
    async (sampleRate: number) => {
      // Idempotent: already running at the same rate — nothing to do
      if (
        audioCtxRef.current &&
        audioCtxRef.current.state !== "closed" &&
        initSampleRateRef.current === sampleRate
      ) {
        return;
      }

      // Tear down any stale context (reconnect with different rate)
      if (audioCtxRef.current) {
        workletRef.current?.port.close();
        workletRef.current?.disconnect();
        gainRef.current?.disconnect();
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
        workletRef.current = null;
        gainRef.current = null;
        initSampleRateRef.current = null;
      }

      try {
        setStatus("loading");

        const ctx = new AudioContext({ sampleRate });
        audioCtxRef.current = ctx;
        initSampleRateRef.current = sampleRate;

        await ctx.audioWorklet.addModule("/audio-stream-processor.js");

        const worklet = new AudioWorkletNode(ctx, "audio-stream-processor", {
          numberOfOutputs: 1,
          outputChannelCount: [1], // mono — matches Inworld output
          processorOptions: { bufferSize },
        });

        const gain = ctx.createGain();
        gain.gain.value = 1;
        gainRef.current = gain;

        worklet.connect(gain);
        gain.connect(ctx.destination);
        workletRef.current = worklet;

        worklet.port.onmessage = (event: MessageEvent) => {
          const { type } = event.data;

          if (type === "bufferHealth") {
            setBufferHealth(event.data.filled / event.data.capacity);
          } else if (type === "drained") {
            playbackStartedRef.current = false;
            pendingSamplesRef.current = 0;
            setBufferHealth(0);
            setStatus("drained");
            onDrainedRef.current?.();
          } else if (type === "underrun") {
            playbackStartedRef.current = false;
            pendingSamplesRef.current = 0;
            setBufferHealth(0);
            onUnderrunRef.current?.();
          }
        };

        worklet.onprocessorerror = (e) => {
          console.error("[AudioWorklet] processor error", e);
          setStatus("error");
          onErrorRef.current?.(new Error("AudioWorklet processor crashed"));
        };

        setStatus("ready");
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setStatus("error");
        onErrorRef.current?.(error);
      }
    },
    [bufferSize],
  );

  // ── pushChunk ─────────────────────────────────────────────────────────────────

  const pushChunk = useCallback(
    (buffer: ArrayBuffer) => {
      const worklet = workletRef.current;
      const ctx = audioCtxRef.current;
      if (!worklet || !ctx) return;

      // Unblock browser-suspended context (autoplay policy)
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      // Decode on the main thread
      const samples: Float32Array =
        encoding === "int16"
          ? int16ToFloat32(buffer)
          : new Float32Array(buffer);

      // Capture length BEFORE transfer — postMessage zero-copy detaches the buffer
      const sampleCount = samples.length;

      // Transfer ownership to worklet (zero-copy — no ArrayBuffer copy in kernel)
      worklet.port.postMessage({ type: "chunk", samples }, [samples.buffer]);

      // Start-threshold gating: hold status at "buffering" until enough samples queued
      if (!playbackStartedRef.current) {
        pendingSamplesRef.current += sampleCount;
        if (pendingSamplesRef.current >= startThreshold) {
          playbackStartedRef.current = true;
          setStatus("playing");
        } else {
          setStatus("buffering");
        }
      }
    },
    [encoding, startThreshold],
  );

  // ── flush ─────────────────────────────────────────────────────────────────────

  const flush = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "flush" });
    pendingSamplesRef.current = 0;
    playbackStartedRef.current = false;
    setBufferHealth(0);
    setStatus((s) => (s === "idle" ? "idle" : "ready"));
  }, []);

  // ── resume ────────────────────────────────────────────────────────────────────

  const resume = useCallback(async () => {
    await audioCtxRef.current?.resume();
  }, []);

  // ── destroy ───────────────────────────────────────────────────────────────────

  const destroy = useCallback(async () => {
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    workletRef.current = null;

    gainRef.current?.disconnect();
    gainRef.current = null;

    await audioCtxRef.current?.close();
    audioCtxRef.current = null;
    initSampleRateRef.current = null;

    pendingSamplesRef.current = 0;
    playbackStartedRef.current = false;
    setBufferHealth(0);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workletRef.current?.port.close();
      workletRef.current?.disconnect();
      gainRef.current?.disconnect();
      audioCtxRef.current?.close();
    };
  }, []);

  return { status, bufferHealth, init, pushChunk, flush, resume, destroy };
}
