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
   * At 48kHz: 192000 ≈ 4s, 96000 ≈ 2s.
   * Larger = more resilient to network jitter. Smaller = lower latency.
   * Default: 192000
   */
  bufferSize?: number;
  /**
   * How many samples to accumulate before beginning playback.
   * Prevents an immediate underrun on the very first chunk.
   * Default: 4800 (100ms @ 48kHz)
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
  /** Called when the buffer underruns mid-playback (network too slow) */
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
   * Must be called from a user-gesture handler (browser autoplay policy).
   * The server sends the rate in the "READY:<rate>" handshake message.
   */
  init: (sampleRate: number) => Promise<void>;
  /**
   * Feed a raw PCM ArrayBuffer received from the WebSocket.
   * No-ops silently if init() hasn't been called yet.
   */
  pushChunk: (buffer: ArrayBuffer) => void;
  /**
   * Clear the ring buffer immediately.
   * Call at the start of a new utterance to discard any leftover audio.
   */
  flush: () => void;
  /** Resume a browser-suspended AudioContext */
  resume: () => Promise<void>;
  /** Fully tear down all resources (call on unmount or disconnect) */
  destroy: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a LINEAR16 (Int16 LE) ArrayBuffer to a Float32Array in [-1, 1].
 * Runs on the main thread so the worklet's process() stays minimal.
 */
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
    bufferSize = 48000, // 1s at 48kHz — enough headroom without inflating health %
    startThreshold = 480, // 10ms at 48kHz — start almost immediately
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

  // Stable callback refs — updated each render without recreating anything
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
  //
  // Called explicitly from a user-gesture handler after the server sends READY:<rate>.
  // Creating AudioContext inside a gesture satisfies browser autoplay policy.

  const init = useCallback(
    async (sampleRate: number) => {
      // Tear down any previous context (e.g. reconnecting with a different rate)
      if (audioCtxRef.current) {
        workletRef.current?.port.close();
        workletRef.current?.disconnect();
        gainRef.current?.disconnect();
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
        workletRef.current = null;
        gainRef.current = null;
      }

      try {
        setStatus("loading");

        const ctx = new AudioContext({ sampleRate });
        audioCtxRef.current = ctx;

        await ctx.audioWorklet.addModule("/audio-stream-processor.js");

        const worklet = new AudioWorkletNode(ctx, "audio-stream-processor", {
          numberOfOutputs: 1,
          outputChannelCount: [1], // mono
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
          }

          if (type === "drained") {
            playbackStartedRef.current = false;
            pendingSamplesRef.current = 0;
            setStatus("drained");
            onDrainedRef.current?.();
          }

          if (type === "underrun" && playbackStartedRef.current) {
            onUnderrunRef.current?.();
          }
        };

        worklet.onprocessorerror = () => {
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

      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      // Decode on the main thread, then transfer ownership to the worklet (zero-copy)
      const samples: Float32Array =
        encoding === "int16"
          ? int16ToFloat32(buffer)
          : new Float32Array(buffer);

      // Capture length BEFORE postMessage — transferring samples.buffer detaches
      // the ArrayBuffer, setting samples.length to 0 on the main thread.
      const sampleCount = samples.length;

      worklet.port.postMessage({ type: "chunk", samples }, [samples.buffer]);

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
    // If we're initialised, go back to ready (not idle)
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
