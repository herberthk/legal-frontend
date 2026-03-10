"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseVoiceSessionOptions {
  /** WebSocket server URL. Defaults to NEXT_PUBLIC_WS_URL or ws://localhost:3001 */
  url: string;
  /** Called when the server streams LLM text deltas */
  onText?: (delta: string) => void;
  /** Called when the server sends an error message */
  onError?: (message: string) => void;
  /** Called when an interrupt is received (new utterance starting) */
  onInterrupt?: () => void;
  /** Called when audio playback finishes for a turn */
  onAudioDone?: () => void;
  /** Called when the server sends the duration of the session in seconds */
  onDuration?: (duration: number) => void;
  /** Whether the audio output should be muted */
  isAudioMuted?: boolean;
}

export interface UseVoiceSessionReturn {
  /** Connection status of the WebSocket */
  wsStatus: VoiceSessionStatus;
  /** Audio playback status */
  audioStatus: VoiceAudioStatus;
  /**
   * Open the WebSocket connection and prepare the AudioContext.
   * Must be called from a user-gesture handler (browser autoplay policy).
   */
  connect: () => void;
  /** Close the WebSocket and stop all audio. */
  disconnect: () => void;
  /**
   * Send a text prompt to the server.
   * Returns the timestamp it was sent (for TTFB tracking).
   */
  send: (text: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useVoiceSession = (
  options: UseVoiceSessionOptions,
): UseVoiceSessionReturn => {
  const {
    url,
    onText,
    onError,
    onInterrupt,
    onAudioDone,
    onDuration,
    isAudioMuted,
  } = options;

  const [wsStatus, setWsStatus] = useState<VoiceSessionStatus>("idle");
  const [audioStatus, setAudioStatus] = useState<VoiceAudioStatus>("idle");

  // Stable callback refs — never stale inside event handlers
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  const onInterruptRef = useRef(onInterrupt);
  const onAudioDoneRef = useRef(onAudioDone);
  const onDurationRef = useRef(onDuration);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onInterruptRef.current = onInterrupt;
  }, [onInterrupt]);
  useEffect(() => {
    onAudioDoneRef.current = onAudioDone;
  }, [onAudioDone]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  const socketRef = useRef<WebSocket | null>(null);

  // ── Audio scheduling (AudioBufferSourceNode timeline) ─────────────────────────
  // Each PCM chunk is scheduled at an exact future time on the AudioContext clock.
  // Late chunks snap to currentTime; early chunks queue ahead. Immune to jitter.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  // All live AudioBufferSourceNodes — used to stop them instantly on interrupt.
  // AudioContext.close() alone does NOT immediately halt already-started nodes.
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const masterGainRef = useRef<GainNode | null>(null);

  // ── Interrupt / TTFB tracking ─────────────────────────────────────────────────
  const sampleRateRef = useRef<number>(48000);
  const interruptingRef = useRef<boolean>(false);
  const promptSentTimeRef = useRef<number>(0);
  const waitingForFirstByteRef = useRef<boolean>(false);

  // ── Audio helpers ─────────────────────────────────────────────────────────────

  const getOrCreateAudioCtx = useCallback(
    (sampleRate: number): AudioContext => {
      if (
        audioCtxRef.current &&
        audioCtxRef.current.state !== "closed" &&
        audioCtxRef.current.sampleRate === sampleRate
      ) {
        return audioCtxRef.current;
      }
      audioCtxRef.current?.close().catch(() => {});
      const ctx = new AudioContext({
        sampleRate,
        latencyHint: "interactive",
      });
      audioCtxRef.current = ctx;

      // Create master gain for muting
      const gainNode = ctx.createGain();
      gainNode.gain.value = isAudioMuted ? 0 : 1;
      gainNode.connect(ctx.destination);
      masterGainRef.current = gainNode;

      nextStartTimeRef.current = ctx.currentTime;
      return ctx;
    },
    [isAudioMuted],
  );

  // Sync mute state to gain node
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        isAudioMuted ? 0 : 1,
        audioCtxRef.current?.currentTime || 0,
        0.01,
      );
    }
  }, [isAudioMuted]);

  const scheduleChunk = useCallback((arrayBuffer: ArrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // Decode LINEAR16 → Float32
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    const SCALING_FACTOR = 1 / 0x8000; // Pre-calculate to avoid division in loop

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] * SCALING_FACTOR;
    }

    // 5ms fade-in/out to remove click artifacts at chunk seams
    // At 48kHz, 240 samples is 5ms
    const fade = Math.min(240, Math.floor(float32.length * 0.1));
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      float32[i] *= g;
      float32[float32.length - 1 - i] *= g;
    }

    const buffer = ctx.createBuffer(1, float32.length, ctx.sampleRate);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (masterGainRef.current) {
      source.connect(masterGainRef.current);
    } else {
      source.connect(ctx.destination);
    }

    if (nextStartTimeRef.current < ctx.currentTime) {
      nextStartTimeRef.current = ctx.currentTime;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    // Track node so stopAudio() can halt it immediately
    activeSourcesRef.current.add(source);
    setAudioStatus("playing");

    // Fire onAudioDone only when the last queued chunk finishes
    source.onended = () => {
      activeSourcesRef.current.delete(source);

      // If we are currently interrupting, ignore the 'ended' event of stale nodes
      if (interruptingRef.current) return;

      const now = audioCtxRef.current?.currentTime ?? 0;
      if (nextStartTimeRef.current <= now + 0.05) {
        setAudioStatus("done");
        onAudioDoneRef.current?.();
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    // stop(0) halts each node immediately — close() alone does not guarantee this
    for (const src of activeSourcesRef.current) {
      try {
        src.stop(0);
        src.disconnect(); // Explicitly detach from audio graph
      } catch {
        /* already stopped */
      }
    }
    activeSourcesRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    nextStartTimeRef.current = 0;
    setAudioStatus("idle");
  }, []);

  // ── Message handler ───────────────────────────────────────────────────────────

  const handleMessage = useCallback(
    (event: MessageEvent<string | ArrayBuffer>) => {
      // console.log("[voice] Message received:", event.data);
      // ── Binary: PCM audio chunk ─────────────────────────────────────────────
      if (event.data instanceof ArrayBuffer) {
        if (interruptingRef.current) return; // drop stale in-flight frames
        if (waitingForFirstByteRef.current) {
          const ttfb = (performance.now() - promptSentTimeRef.current).toFixed(
            1,
          );
          console.log(`[voice] TTFB: ${ttfb}ms`);
          waitingForFirstByteRef.current = false;
        }
        scheduleChunk(event.data);
        return;
      }

      if (typeof event.data !== "string") return;

      // ── READY:<rate> ────────────────────────────────────────────────────────
      if (event.data.startsWith("READY:")) {
        const rate = parseInt(event.data.slice(6), 10);
        console.log(`[voice] ready — ${rate}Hz`);
        sampleRateRef.current = rate;
        getOrCreateAudioCtx(rate);
        return;
      }

      if (event.data.startsWith("TIME:")) {
        const time = event.data.slice(5);
        // console.log(`[voice] time — ${time}`);
        onDurationRef.current?.(+time);
        return;
      }

      // ── TEXT:<delta> ──────────────
      if (event.data.startsWith("TEXT:")) {
        // console.log("[voice] TEXT:", event.data.slice(5));
        onTextRef.current?.(event.data.slice(5));
        return;
      }

      // ── START_TURN ────────────────
      if (event.data === "START_TURN") {
        console.log("[voice] START_TURN — audio guard cleared");
        interruptingRef.current = false;
        return;
      }

      // ── INTERRUPT ───────────────────────────────────────────────────────────
      if (event.data === "INTERRUPT") {
        console.log("[voice] INTERRUPT");
        interruptingRef.current = true;
        stopAudio();
        getOrCreateAudioCtx(sampleRateRef.current);
        onInterruptRef.current?.();
        return;
      }

      // ── DONE ────────────────────────────────────────────────────────────────
      if (event.data === "DONE") {
        console.log("[voice] DONE");
        interruptingRef.current = false;
        return;
      }

      // ── ERROR:<message> ─────────────────────────────────────────────────────
      if (event.data.startsWith("ERROR:")) {
        const msg = event.data.slice(6).trim();
        console.error("[voice] error:", msg);
        onErrorRef.current?.(msg);
        return;
      }
    },
    [scheduleChunk, stopAudio, getOrCreateAudioCtx],
  );

  // ── Public API ────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // AudioContext must be created inside a user gesture (autoplay policy)
    getOrCreateAudioCtx(48000);

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    socketRef.current = ws;
    setWsStatus("connecting");

    ws.onopen = () => {
      console.log("[voice] connected");
      setWsStatus("open");
    };
    ws.onmessage = handleMessage;
    ws.onerror = (err) => {
      console.log("[voice] ws error", err);
      setWsStatus("error");
    };
    ws.onclose = (ev) => {
      console.log("[voice] closed", ev.code);
      setWsStatus("closed");
    };
  }, [url, getOrCreateAudioCtx, handleMessage]);

  const disconnect = useCallback(() => {
    stopAudio();
    socketRef.current?.close();
    socketRef.current = null;
    setWsStatus("idle");
  }, [stopAudio]);

  const send = useCallback(
    (text: string) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // ── Local Interruption ───────────────────────────────────────────────────
      // Stop any currently playing audio and guard against stale frames immediately.
      // This eliminates the round-trip latency to the server for interruptions.
      interruptingRef.current = true;
      stopAudio();
      // Pre-create a fresh AudioContext so we're ready for the new response audio.
      getOrCreateAudioCtx(sampleRateRef.current);
      // ─────────────────────────────────────────────────────────────────────────

      promptSentTimeRef.current = performance.now();
      waitingForFirstByteRef.current = true;
      ws.send(text);
    },
    [stopAudio, getOrCreateAudioCtx],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.close();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return { wsStatus, audioStatus, connect, disconnect, send };
};
