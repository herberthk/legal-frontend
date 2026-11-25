import { useState, useRef, useCallback, useEffect } from "react";
import { GoogleGenAI, Session } from "@google/genai";
import {
  buildClientVoiceLiveConfig,
  GEMINI_LIVE_API_VERSION,
  GEMINI_LIVE_MODEL,
} from "@/lib/voice/live-config";
import NoSleep from "@zakj/no-sleep";

import {
  createGeminiAudioChain,
  DEFAULT_OUTPUT_GAIN,
} from "./use-gemini-live/audio-setup";
import {
  claimMicStream,
  detectNativeSampleRate,
  parkMicStream,
} from "./use-gemini-live/mic-stream";
import { useFirebaseSync } from "./use-gemini-live/use-firebase-sync";
import { useEphemeralToken } from "./use-gemini-live/use-ephemeral-token";

const OUTPUT_GAIN = DEFAULT_OUTPUT_GAIN ?? 1.05;
const BARGE_IN_OUTPUT_GAIN = 0.15;
const PROCESSING_TIMEOUT_MS = 8_000;
const TURN_STALL_FALLBACK_MS = 2_500;
// public/voices/connected.mp3 is ~2.06s; hold outgoing mic frames past its tail
// so the connected chime never leaks into Gemini during the opening greeting.
const CONNECTED_CHIME_HOLD_MS = 2_300;
// Pre-warm a fresh single-use reconnect token every 8.5 minutes (510s), right
// before Google Live's ~10-minute connection rotation window.
const RECONNECT_TOKEN_PREWARM_INTERVAL_S = 510;
// Buffer up to ~2.0s (50 × 40ms frames) of active user speech across a brief
// GoAway socket handoff so words spoken mid-rotation are never dropped, and
// discard chunks older than 3s so multi-second outages never replay stale audio.
const MAX_RECONNECT_AUDIO_CHUNKS = 50;
const MAX_RECONNECT_AUDIO_AGE_MS = 3_000;
const MAX_RECONNECT_HISTORY_TURNS = 8;
// Cache-busting token for /public/js AudioWorklets so updated DSP code bypasses
// browser HTTP caches and previously active service worker caches.
const WORKLET_VERSION = "2026-11-25-v5";
const PCM_PROCESSOR_URL = `/js/pcm-processor.js?v=${WORKLET_VERSION}`;
const PCM_PLAYER_PROCESSOR_URL = `/js/pcm-player-processor.js?v=${WORKLET_VERSION}`;

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

function encodePcmToBase64(pcm: ArrayBuffer): string {
  const uint8Array = new Uint8Array(pcm);
  let binaryStr = "";
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binaryStr += String.fromCharCode.apply(
      null,
      uint8Array.subarray(i, i + CHUNK_SIZE) as unknown as number[],
    );
  }
  return btoa(binaryStr);
}

export function parseGoAwayDelayMs(timeLeft: unknown): number {
  if (typeof timeLeft === "string") {
    const match = timeLeft.trim().match(/^(\d+(?:\.\d+)?)s$/);
    if (match) {
      const ms = Number(match[1]) * 1000;
      if (Number.isFinite(ms) && ms > 0) {
        if (ms <= 1_500) return 0;
        const safetyBuffer = Math.min(5_000, Math.floor(ms / 2));
        return Math.min(10_000, ms - safetyBuffer);
      }
    }
  }
  return 2_500;
}

function sendSessionTextTurn(
  session: Session | null,
  text: string,
  turnComplete: boolean,
) {
  if (!session) return;
  if (typeof session.sendClientContent === "function") {
    session.sendClientContent({
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete,
    });
  } else {
    session.sendRealtimeInput({ text });
  }
}

export const useGeminiLive = ({
  userName,
  preferedVoice,
  userId,
  onUserAudioChunk,
  onAIAudioChunk,
  onDurationLimitReached,
  onSessionStart,
  onMicReady,
  onError,
  totalAllowedSeconds,
}: UseGeminiLiveOptions) => {
  // Session UI states
  const [wsStatus, setWsStatus] = useState<VoiceSessionStatus>("idle");
  const [audioStatus, setAudioStatus] = useState<VoiceAudioStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTranscript, setActiveTranscript] =
    useState<AgentTranscript | null>(null);

  // Keeps the screen awake during an active session
  const noSleep = useRef(new NoSleep());

  // --- Audio level state for visualization ---
  // Smoothed RMS values (0-1) sampled into React state at ~30fps
  const micLevelRef = useRef(0);
  const aiAudioLevelRef = useRef(0);
  const [micLevel, setMicLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);

  const levelRafRef = useRef<number>(0);
  const scheduleLevelUpdate = useCallback(() => {
    if (levelRafRef.current) return;
    levelRafRef.current = requestAnimationFrame(() => {
      levelRafRef.current = 0;
      setMicLevel(micLevelRef.current);
      setAiAudioLevel(aiAudioLevelRef.current);
      aiAudioLevelRef.current *= 0.85; // Decay AI level toward zero
    });
  }, []);

  // --- Core references ---
  const aiClientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const previousHandleRef = useRef<string | null>(null);
  const isDisconnectingRef = useRef(false);
  const isSessionReadyRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const isModelTurnActiveRef = useRef(false);
  const isMicMutedRef = useRef(false);
  const isAudioMutedRef = useRef(false);
  const sentAudioSinceEndRef = useRef(false);
  const micHoldUntilRef = useRef(0);
  const wasUserSpeakingRef = useRef(false);
  const wasBargedInRef = useRef(false);
  const pendingReconnectAudioRef = useRef<
    Array<{ data: string; capturedAt: number }>
  >([]);
  const pendingGoAwayRotationRef = useRef(false);
  const goAwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWorkletAISpeakingRef = useRef<boolean | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionAttemptRef = useRef(0);
  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current !== null) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);
  const clearTurnStallTimer = useCallback(() => {
    if (turnStallTimerRef.current !== null) {
      clearTimeout(turnStallTimerRef.current);
      turnStallTimerRef.current = null;
    }
  }, []);
  const cancelRetry = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (goAwayTimerRef.current !== null) {
      clearTimeout(goAwayTimerRef.current);
      goAwayTimerRef.current = null;
    }
    clearProcessingTimer();
    clearTurnStallTimer();
    pendingGoAwayRotationRef.current = false;
  }, [clearProcessingTimer, clearTurnStallTimer]);
  const connectToGeminiRef = useRef<
    | ((isReconnect?: boolean, forceTokenRefresh?: boolean) => Promise<void>)
    | null
  >(null);
  const disconnectFromGeminiRef = useRef<(() => Promise<void>) | null>(null);

  const [duration, setDuration] = useState(0);

  // The session id lives in both a ref and state on purpose:
  //   • the ref is what connectToGemini mints and what the sync/billing paths
  //     read, so they always agree on the id of the call happening right now;
  //   • the state is what consumers render against, so nothing reads a ref
  //     during render (the React Compiler is on, and a render-time ref read is
  //     not something it can safely memoize).
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const sessionIdRef = useRef<string>(sessionId);

  // Controls the auto-reconnection loop for dropped or goAway connections
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Transcript memory accumulation
  const userPartsRef = useRef<string[]>([]);
  const aiPartsRef = useRef<string[]>([]);
  const allTranscriptsRef = useRef<Transcript[]>([]);
  // Bounded per-call history retained independently of allTranscriptsRef
  // (which useFirebaseSync drains after Firestore writes) for handle-less reseeding.
  const reconnectHistoryRef = useRef<Transcript[]>([]);

  // Sub-hooks for modularity
  const { syncSessionToBuffer, heartbeatBuffer } = useFirebaseSync({
    sessionIdRef,
    userId,
    userName,
    preferedVoice,
    allTranscriptsRef,
  });

  const {
    getEphemeralToken,
    prefetchToken: prefetchEphemeralToken,
    clearCachedToken,
  } = useEphemeralToken();

  // --- Audio Processing Contexts ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  // Muted sink that keeps the mic worklet inside the rendering graph (see below)
  const micSinkRef = useRef<GainNode | null>(null);

  // --- Extended Audio Chain Refs ---
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceEQRef = useRef<BiquadFilterNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const outputTrimRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Latest callback references to avoid dependency re-renders
  const onUserAudioChunkRef = useRef(onUserAudioChunk);
  const onAIAudioChunkRef = useRef(onAIAudioChunk);
  const onSessionStartRef = useRef(onSessionStart);
  const onMicReadyRef = useRef(onMicReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUserAudioChunkRef.current = onUserAudioChunk;
  }, [onUserAudioChunk]);

  useEffect(() => {
    onAIAudioChunkRef.current = onAIAudioChunk;
  }, [onAIAudioChunk]);

  useEffect(() => {
    onSessionStartRef.current = onSessionStart;
  }, [onSessionStart]);

  useEffect(() => {
    onMicReadyRef.current = onMicReady;
  }, [onMicReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const sessionStartRef = useRef<number>(0);

  const appendReconnectHistory = useCallback((entry: Transcript) => {
    const history = reconnectHistoryRef.current;
    history.push(entry);
    if (history.length > MAX_RECONNECT_HISTORY_TURNS) {
      history.splice(0, history.length - MAX_RECONNECT_HISTORY_TURNS);
    }
  }, []);

  // Finalizes the current user statement and appends it to transcripts history
  const finalizeUserTurn = useCallback(() => {
    if (userPartsRef.current.length > 0) {
      const fullText = userPartsRef.current.join("").trim();
      if (fullText) {
        const entry: Transcript = { role: "user", content: fullText };
        allTranscriptsRef.current.push(entry);
        appendReconnectHistory(entry);
      }
      userPartsRef.current = [];
    }
  }, [appendReconnectHistory]);

  // Finalizes the current AI statement and appends it to transcripts history
  const finalizeAITurn = useCallback(() => {
    if (aiPartsRef.current.length > 0) {
      const fullText = aiPartsRef.current.join("").trim();
      if (fullText) {
        const entry: Transcript = { role: "AI", content: fullText };
        allTranscriptsRef.current.push(entry);
        appendReconnectHistory(entry);
      }
      aiPartsRef.current = [];
    }
  }, [appendReconnectHistory]);

  /**
   * Initializes or returns the cached AudioContext along with the
   * custom broadcast-quality audio chain (EQ, Limiter).
   */
  const getOrCreateAudioCtx = useCallback((sampleRate: number) => {
    if (
      audioCtxRef.current &&
      audioCtxRef.current.state !== "closed" &&
      audioCtxRef.current.sampleRate === sampleRate
    ) {
      return audioCtxRef.current;
    }

    audioCtxRef.current?.close().catch(() => {});
    const AudioContextClass =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({
      sampleRate,
      latencyHint: "interactive",
    });
    audioCtxRef.current = ctx;

    // Utilize modular audio chain setup
    const chain = createGeminiAudioChain(ctx);
    highPassRef.current = chain.highPass;
    presenceEQRef.current = chain.presenceEQ;
    masterGainRef.current = chain.masterGain;
    limiterRef.current = chain.limiter;
    outputTrimRef.current = chain.outputTrim;

    return ctx;
  }, []);

  const wsStatusRef = useRef(wsStatus);
  const audioStatusRef = useRef(audioStatus);
  const durationRef = useRef(duration);
  const effectiveLimit = Math.min(totalAllowedSeconds, 1800);
  const effectiveLimitRef = useRef(effectiveLimit);

  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);
  useEffect(() => {
    audioStatusRef.current = audioStatus;
  }, [audioStatus]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    effectiveLimitRef.current = effectiveLimit;
  }, [effectiveLimit]);

  const setWorkletAISpeaking = useCallback((speaking: boolean) => {
    const processor = processorRef.current;
    if (!processor) return;
    if (lastWorkletAISpeakingRef.current === speaking) return;
    lastWorkletAISpeakingRef.current = speaking;
    processor.port.postMessage({
      command: "aiSpeaking",
      value: speaking,
    });
  }, []);

  const clearProcessing = useCallback(() => {
    clearProcessingTimer();
    setIsProcessing(false);
  }, [clearProcessingTimer]);

  const startProcessing = useCallback(() => {
    clearProcessingTimer();
    setIsProcessing(true);
    processingTimerRef.current = setTimeout(() => {
      processingTimerRef.current = null;
      setIsProcessing(false);
    }, PROCESSING_TIMEOUT_MS);
  }, [clearProcessingTimer]);

  const setOutputDucking = useCallback((ducked: boolean) => {
    if (isAudioMutedRef.current) return;
    const gainParam = masterGainRef.current?.gain;
    const ctx = audioCtxRef.current;
    if (gainParam && ctx && typeof gainParam.setTargetAtTime === "function") {
      gainParam.setTargetAtTime(
        ducked ? BARGE_IN_OUTPUT_GAIN : OUTPUT_GAIN,
        ctx.currentTime,
        0.02,
      );
    }
  }, []);

  /**
   * Schedules a chunk of PCM audio received from Gemini API for playback.
   * Feeds visualizer data and intercepts audio buffers if recordings are active.
   */
  const schedulePCMChunk = useCallback(
    (base64Data: string) => {
      const player = playerNodeRef.current;
      if (!player) return;

      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});

      // Duck the mic synchronously BEFORE enqueueing audio so the first frame
      // of AI speech never leaks into the mic before React's effect runs.
      clearTurnStallTimer();
      isModelTurnActiveRef.current = true;
      setWorkletAISpeaking(true);
      if (!wasBargedInRef.current) {
        setOutputDucking(false);
      }
      clearProcessing();

      // Convert Base64 payload to UInt8 buffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Slice out an identical copy for the audio chunk callback (recorder)
      // because passing `bytes.buffer` via postMessage detaches it completely.
      if (onAIAudioChunkRef.current) {
        const recordBuf = bytes.slice().buffer;
        const ts = Date.now() - sessionStartRef.current;
        onAIAudioChunkRef.current(recordBuf, ts);
      }

      // Measure AI audio level for UI visualization
      {
        const int16View = new Int16Array(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength / 2,
        );
        let sum = 0;
        for (let i = 0; i < int16View.length; i++) {
          const sample = int16View[i] / 0x8000;
          sum += sample * sample;
        }
        aiAudioLevelRef.current = Math.sqrt(sum / int16View.length);
        scheduleLevelUpdate();
      }

      // Queue playback payload
      player.port.postMessage(bytes.buffer, [bytes.buffer]);
      audioStatusRef.current = "playing";
      setAudioStatus("playing");
    },
    [
      scheduleLevelUpdate,
      setWorkletAISpeaking,
      setOutputDucking,
      clearProcessing,
      clearTurnStallTimer,
    ],
  );

  const stopAudio = useCallback(() => {
    clearTurnStallTimer();
    isModelTurnActiveRef.current = false;
    setWorkletAISpeaking(false);
    setOutputDucking(false);
    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ command: "endOfAudio" });
    }
    audioStatusRef.current = "idle";
    setAudioStatus("idle");
  }, [setWorkletAISpeaking, setOutputDucking, clearTurnStallTimer]);

  // Tell the mic worklet when the AI is audible so it can duck the outgoing
  // stream. Without this the AI hears its own voice back through the mic and
  // holds a conversation with itself — browser echo cancellation doesn't help,
  // because Firefox never uses AudioContext output as its AEC reference.
  useEffect(() => {
    setWorkletAISpeaking(
      audioStatus === "playing" || isModelTurnActiveRef.current,
    );
  }, [audioStatus, setWorkletAISpeaking]);

  /**
   * Main connection loop to the Gemini WebSockets Live API.
   * Handles initialization, reconnect cycles, VAD streaming, and incoming transcripts.
   */
  const connectToGemini = useCallback(
    async (isReconnect = false, forceTokenRefresh = false) => {
      if (
        !isReconnect &&
        (wsStatusRef.current === "connecting" || wsStatusRef.current === "open")
      )
        return;
      if (isReconnect && isDisconnectingRef.current) return;
      cancelRetry();
      const attempt = ++connectionAttemptRef.current;
      const isCurrent = () =>
        attempt === connectionAttemptRef.current && !isDisconnectingRef.current;
      let retryOwned = false;
      let connectionErrored = false;
      let transportOpened = false;
      let setupCompleted = false;

      // Both close and rejection report failures, but each attempt owns one retry.
      const scheduleRetry = (isError: boolean) => {
        if (
          !isCurrent() ||
          retryOwned ||
          durationRef.current >= effectiveLimitRef.current
        )
          return;
        retryOwned = true;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          isSessionReadyRef.current = false;
          isReconnectingRef.current = false;
          setWsStatus("error");
          setActiveTranscript({
            speaker: "system",
            text: "Connection lost. Please try again.",
          });
          onErrorRef.current?.(
            new Error(
              `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`,
            ),
          );
          reconnectAttemptsRef.current = 0;
          return;
        }
        // In Gemini Live WebSockets, ephemeral tokens are strictly single-use.
        // Clean GoAway rotations immediately consume a pre-warmed unused token
        // (0 ms delay) when available; error retries force a brand-new fetch
        // with exponential backoff.
        isReconnectingRef.current = true;
        if (isError) reconnectAttemptsRef.current += 1;
        const delay = isError
          ? Math.min(500 * reconnectAttemptsRef.current, 5000)
          : 0;
        debugLog(
          `[gemini-live] Seamlessly reconnecting (attempt ${reconnectAttemptsRef.current})...`,
        );
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (isCurrent()) {
            connectToGeminiRef.current?.(true, isError);
          }
        }, delay);
      };

      try {
        isDisconnectingRef.current = false;

        // Reset state only on fresh starts, avoid UI jumps during background reconnects
        if (!isReconnect) {
          isSessionReadyRef.current = false;
          isReconnectingRef.current = false;
          isModelTurnActiveRef.current = false;
          sentAudioSinceEndRef.current = false;
          wasUserSpeakingRef.current = false;
          wasBargedInRef.current = false;
          pendingReconnectAudioRef.current = [];
          micHoldUntilRef.current = 0;
          setOutputDucking(false);
          setIsProcessing(false);
          wsStatusRef.current = "connecting";
          setWsStatus("connecting");
          noSleep.current.enable();
          setDuration(0);
          durationRef.current = 0;
          allTranscriptsRef.current = [];
          reconnectHistoryRef.current = [];
          userPartsRef.current = [];
          aiPartsRef.current = [];
          setActiveTranscript(null);
          previousHandleRef.current = null;
          // Ref first: the recorder and the buffer sync both read it, and they
          // must see the new id before any audio or transcript is written. The
          // state update below is only what the UI renders.
          sessionIdRef.current = crypto.randomUUID();
          setSessionId(sessionIdRef.current);
          // Hand the id to the recorder before the socket opens — the first
          // chunks land milliseconds after the handshake, and they must be
          // filed under the same session that billing and cleanup will use.
          onSessionStartRef.current?.(sessionIdRef.current);
          reconnectAttemptsRef.current = 0;
        }

        // Fire token fetch immediately!
        // useEphemeralToken strictly consumes any prefetched token once, so a
        // clean GoAway rotation (forceTokenRefresh=false) reuses the pre-warmed
        // unused token with zero network wait, while error retries force a fresh
        // fetch. Keep tokenMaxSecs fixed to effectiveLimitRef so the locked
        // systemInstruction never drifts mid-session across rotations.
        const tokenPromise = getEphemeralToken(
          forceTokenRefresh,
          effectiveLimitRef.current,
          preferedVoice.preferedVoiceId,
          preferedVoice.preferedVoiceName,
        );

        let ctx = audioCtxRef.current;
        let processor = processorRef.current;
        let source: MediaStreamAudioSourceNode | undefined;

        // Initialize mic and worklet layers
        const needsAudioSetup =
          !isReconnect ||
          !audioCtxRef.current ||
          audioCtxRef.current.state === "closed" ||
          !processorRef.current;

        if (needsAudioSetup) {
          ctx = getOrCreateAudioCtx(24000);
          // Reuses the stream MicrophoneSoftPrompt already obtained when one is
          // live, so Firefox isn't asked to prompt a second time.
          const stream = await claimMicStream();

          // Every await between here and the worklet nodes is a window where
          // this attempt can be superseded — the connect timeout, an End
          // tap, or a second connect all run disconnectFromGemini, which
          // closes the context. Building on a closed context does not fail
          // quietly: addModule rejects with AbortError ("Unable to load a
          // worklet's module") and the AudioWorkletNode constructor throws
          // InvalidStateError ("No execution context available"). A mic prompt
          // left open past the timeout hits this every time, so re-check after
          // each await and bail instead.
          const isSuperseded = (c: AudioContext) =>
            isDisconnectingRef.current ||
            audioCtxRef.current !== c ||
            c.state === "closed";

          // Park rather than stop: whoever superseded us owns the teardown and
          // the UI status, and a parked stream lets the retry reuse this grant
          // instead of prompting again. MicrophoneSoftPrompt releases it if the
          // user leaves the page without retrying.
          const abandon = () => {
            if (mediaStreamRef.current === stream)
              mediaStreamRef.current = null;
            parkMicStream(stream);
          };

          if (isSuperseded(ctx)) {
            abandon();
            return;
          }
          mediaStreamRef.current = stream;
          if (isMicMutedRef.current) {
            stream.getAudioTracks().forEach((track) => {
              track.enabled = false;
            });
          }

          // The mic is live and this attempt is still the current one, so the
          // caller's connect timeout can stop making room for a permission
          // dialog and get strict about the network work that is left.
          onMicReadyRef.current?.();

          await Promise.all([
            ctx.audioWorklet.addModule(PCM_PROCESSOR_URL),
            ctx.audioWorklet.addModule(PCM_PLAYER_PROCESSOR_URL),
          ]);

          if (isSuperseded(ctx)) {
            abandon();
            return;
          }

          try {
            source = ctx.createMediaStreamSource(stream);
          } catch (err) {
            // Older Firefox refuses to bridge a mic running at the hardware
            // rate into a context pinned to a different rate (Bugzilla 1674892
            // fixed this, but pre-fix builds throw NotSupportedError). Rebuild
            // the context at the device's native rate — pcm-processor.js reads
            // the global `sampleRate` and resamples to 16 kHz either way, and
            // pcm-player-processor.js reads from its ring buffer at whatever
            // rate the context runs, so both worklets stay correct.
            console.warn(
              "[gemini-live] 24kHz context rejected the mic stream, falling back to the device rate:",
              err,
            );
            ctx = getOrCreateAudioCtx(detectNativeSampleRate(stream));
            await Promise.all([
              ctx.audioWorklet.addModule(PCM_PROCESSOR_URL),
              ctx.audioWorklet.addModule(PCM_PLAYER_PROCESSOR_URL),
            ]);

            if (isSuperseded(ctx)) {
              abandon();
              return;
            }

            source = ctx.createMediaStreamSource(stream);
          }

          processor = new AudioWorkletNode(ctx, "pcm-processor", {
            channelCount: 1,
          });
          processorRef.current = processor;
          lastWorkletAISpeakingRef.current = null;

          // Firefox only runs process() on worklet nodes that reach the
          // destination — nodes with no downstream path are pruned from the
          // rendering graph (Chrome instead keeps any node alive that returns
          // true from process(), which is why this was Chrome-only-working).
          // Route the mic worklet to destination through a 0-gain node: the
          // graph stays live, and nothing is ever audible so there's no
          // feedback loop from the mic into the speakers.
          const micSink = ctx.createGain();
          micSink.gain.value = 0;
          processor.connect(micSink);
          micSink.connect(ctx.destination);
          micSinkRef.current = micSink;

          const playerNode = new AudioWorkletNode(ctx, "pcm-player-processor");
          playerNode.connect(
            highPassRef.current || masterGainRef.current || ctx.destination,
          );
          playerNodeRef.current = playerNode;

          playerNode.port.onmessage = (e) => {
            if (e.data?.type === "bufferEmpty") {
              audioStatusRef.current = "done";
              setAudioStatus("done");
              if (!isModelTurnActiveRef.current) {
                setWorkletAISpeaking(false);
              } else {
                clearTurnStallTimer();
                turnStallTimerRef.current = setTimeout(() => {
                  turnStallTimerRef.current = null;
                  if (isModelTurnActiveRef.current) {
                    isModelTurnActiveRef.current = false;
                    setWorkletAISpeaking(false);
                  }
                }, TURN_STALL_FALLBACK_MS);
              }
            }
          };
        } else {
          if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
        }

        const token = await tokenPromise;
        if (!isCurrent()) return;

        aiClientRef.current = new GoogleGenAI({
          apiKey: token,
          httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
        });

        // Initialize Gemini model config.
        // NOTE: systemInstruction is securely embedded and locked inside the ephemeral
        // token on the server (/api/gemini-token). It never reaches client bundles or network logs.
        const config = buildClientVoiceLiveConfig({
          preferedVoiceId: preferedVoice.preferedVoiceId,
          resumptionHandle: previousHandleRef.current,
        });

        const session = await aiClientRef.current.live.connect({
          model: GEMINI_LIVE_MODEL,
          config,
          callbacks: {
            onopen: () => {
              if (!isCurrent() || retryOwned) return;
              transportOpened = true;
              debugLog("[gemini-live] transport open");

              if (processor && source && needsAudioSetup)
                source.connect(processor);

              // Setup microphone audio transmission
              if (processor) {
                processor.port.onmessage = (e) => {
                  if (isDisconnectingRef.current) return;

                  // While rotating sockets during a seamless reconnect, buffer
                  // active user speech (~2s ring) so words spoken mid-handoff
                  // are flushed immediately once the new socket opens.
                  if (isReconnectingRef.current) {
                    const { pcm, volume, isSpeaking } = e.data;
                    const activeSpeech =
                      !isMicMutedRef.current &&
                      Date.now() >= micHoldUntilRef.current &&
                      !!isSpeaking;
                    if (activeSpeech !== wasUserSpeakingRef.current) {
                      setIsListening(activeSpeech);
                      wasUserSpeakingRef.current = activeSpeech;
                    }
                    if (activeSpeech && pcm) {
                      const base64Audio = encodePcmToBase64(pcm);
                      const queue = pendingReconnectAudioRef.current;
                      if (queue.length >= MAX_RECONNECT_AUDIO_CHUNKS) {
                        queue.shift();
                      }
                      queue.push({ data: base64Audio, capturedAt: Date.now() });
                      if (onUserAudioChunkRef.current) {
                        const ts = Date.now() - sessionStartRef.current;
                        onUserAudioChunkRef.current(pcm, ts);
                      }
                      micLevelRef.current = volume;
                      scheduleLevelUpdate();
                    }
                    return;
                  }

                  if (!isSessionReadyRef.current) return;

                  // While muted or during the initial connected-chime hold window,
                  // do not stream silent/chime PCM into Gemini.
                  if (
                    isMicMutedRef.current ||
                    Date.now() < micHoldUntilRef.current
                  ) {
                    if (micLevelRef.current !== 0) {
                      micLevelRef.current = 0;
                      scheduleLevelUpdate();
                    }
                    if (wasUserSpeakingRef.current) {
                      setIsListening(false);
                      wasUserSpeakingRef.current = false;
                    }
                    if (wasBargedInRef.current) {
                      wasBargedInRef.current = false;
                      setOutputDucking(false);
                    }
                    return;
                  }

                  const { pcm, volume, isSpeaking, bargedIn } = e.data;
                  const nextBargedIn = !!bargedIn;
                  if (nextBargedIn && !wasBargedInRef.current) {
                    debugLog(
                      `[gemini-live] Barge-in triggered (rms=${typeof volume === "number" ? volume.toFixed(3) : volume})`,
                    );
                    setOutputDucking(true);
                  } else if (!nextBargedIn && wasBargedInRef.current) {
                    setOutputDucking(false);
                  }
                  wasBargedInRef.current = nextBargedIn;
                  if (isSpeaking !== wasUserSpeakingRef.current) {
                    setIsListening(isSpeaking);
                  }

                  if (isSpeaking) {
                    clearProcessing();
                  } else if (
                    wasUserSpeakingRef.current &&
                    audioStatusRef.current !== "playing"
                  ) {
                    startProcessing();
                  }
                  wasUserSpeakingRef.current = isSpeaking;

                  micLevelRef.current = volume;
                  scheduleLevelUpdate();

                  if (sessionRef.current) {
                    const base64Audio = encodePcmToBase64(pcm);

                    try {
                      sessionRef.current.sendRealtimeInput({
                        audio: {
                          data: base64Audio,
                          mimeType: "audio/pcm;rate=16000",
                        },
                      });
                      sentAudioSinceEndRef.current = true;
                    } catch (err) {
                      console.error(
                        "[gemini-live] sendRealtimeInput failed:",
                        err,
                      );
                      // Clear sessionRef first so subsequent 25 Hz frames cannot
                      // spam sendRealtimeInput/close(), claim retry ownership BEFORE
                      // closing so a synchronous onclose cannot enter the terminal
                      // error/closed branch, then close the failing transport.
                      const failingSession = sessionRef.current;
                      sessionRef.current = null;
                      isSessionReadyRef.current = false;
                      clearProcessing();
                      isModelTurnActiveRef.current = false;
                      scheduleRetry(true);
                      try {
                        failingSession?.close();
                      } catch {
                        // Transport may already be closed
                      }
                      return;
                    }

                    if (onUserAudioChunkRef.current && isSpeaking) {
                      const ts = Date.now() - sessionStartRef.current;
                      onUserAudioChunkRef.current(pcm, ts);
                    }
                  }
                };
              }
            },
            onmessage: (msg) => {
              if (!isCurrent() || retryOwned) return;

              if (msg.serverContent?.interrupted) {
                debugLog(
                  `[gemini-live] Interrupted! (audioStatus=${audioStatusRef.current}, modelTurnActive=${isModelTurnActiveRef.current})`,
                );
                isModelTurnActiveRef.current = false;
                clearProcessing();
                finalizeAITurn();
                finalizeUserTurn();
                stopAudio();
              }

              if (msg.serverContent?.waitingForInput) {
                clearProcessing();
              }

              if (
                msg.sessionResumptionUpdate?.newHandle &&
                msg.sessionResumptionUpdate.resumable !== false
              ) {
                previousHandleRef.current =
                  msg.sessionResumptionUpdate.newHandle;
              }

              // Server requested rotation: immediately prefetch a fresh single-use
              // token while the current socket finishes its turn, then close so
              // onclose hands off with 0ms delay and the saved resumption handle.
              if (msg.goAway) {
                debugLog(
                  "[gemini-live] Received GoAway. Scheduling graceful rotation...",
                );
                if (!isDisconnectingRef.current) {
                  if (durationRef.current < effectiveLimitRef.current) {
                    prefetchEphemeralToken(
                      effectiveLimitRef.current,
                      preferedVoice.preferedVoiceId,
                      preferedVoice.preferedVoiceName,
                    );
                  }
                  if (
                    durationRef.current >= effectiveLimitRef.current ||
                    (!isModelTurnActiveRef.current &&
                      audioStatusRef.current !== "playing" &&
                      !wasUserSpeakingRef.current)
                  ) {
                    sessionRef.current?.close();
                  } else {
                    const waitMs = parseGoAwayDelayMs(msg.goAway.timeLeft);
                    if (waitMs <= 0) {
                      pendingGoAwayRotationRef.current = false;
                      sessionRef.current?.close();
                    } else {
                      pendingGoAwayRotationRef.current = true;
                      if (!goAwayTimerRef.current) {
                        goAwayTimerRef.current = setTimeout(() => {
                          goAwayTimerRef.current = null;
                          if (pendingGoAwayRotationRef.current && isCurrent()) {
                            pendingGoAwayRotationRef.current = false;
                            sessionRef.current?.close();
                          }
                        }, waitMs);
                      }
                    }
                  }
                }
              }

              // Route PCM data to playback
              if (msg.serverContent?.modelTurn?.parts) {
                for (const part of msg.serverContent.modelTurn.parts) {
                  if (
                    part.inlineData &&
                    part.inlineData?.mimeType?.startsWith("audio/pcm")
                  ) {
                    schedulePCMChunk(part.inlineData.data as string);
                  }
                }
              }

              // Accumulate textual transcripts emitted by API processing
              if (msg.serverContent?.inputTranscription) {
                const txt = msg.serverContent.inputTranscription.text;
                if (txt) {
                  finalizeAITurn();
                  userPartsRef.current.push(txt);
                  setActiveTranscript({
                    speaker: "user",
                    text: userPartsRef.current.join(""),
                  });
                }
              }

              if (msg.serverContent?.outputTranscription) {
                const txt = msg.serverContent.outputTranscription.text;
                if (txt) {
                  finalizeUserTurn();
                  aiPartsRef.current.push(txt);
                  setActiveTranscript({
                    speaker: "ai",
                    text: aiPartsRef.current.join(""),
                  });
                }
              }

              if (msg.serverContent?.turnComplete) {
                finalizeUserTurn();
                finalizeAITurn();
              }

              if (
                msg.serverContent?.turnComplete ||
                msg.serverContent?.generationComplete
              ) {
                clearTurnStallTimer();
                isModelTurnActiveRef.current = false;
                clearProcessing();
                if (audioStatusRef.current !== "playing") {
                  setWorkletAISpeaking(false);
                }
                // Wait for turnComplete (or idle playback) before closing on a
                // deferred GoAway — generationComplete arrives ~5-7x faster than
                // real-time playback, so closing there would cut off live audio
                // or rotate before a resumable session handle is issued.
                if (
                  pendingGoAwayRotationRef.current &&
                  (msg.serverContent?.turnComplete ||
                    audioStatusRef.current !== "playing")
                ) {
                  if (goAwayTimerRef.current) {
                    clearTimeout(goAwayTimerRef.current);
                    goAwayTimerRef.current = null;
                  }
                  pendingGoAwayRotationRef.current = false;
                  if (
                    !isDisconnectingRef.current &&
                    durationRef.current < effectiveLimitRef.current
                  ) {
                    sessionRef.current?.close();
                  }
                }
              }
            },
            onerror: (err) => {
              if (!isCurrent() || retryOwned) return;
              console.error("[gemini-live] Error:", err);
              clearTurnStallTimer();
              sessionRef.current = null;
              setIsListening(false);
              clearProcessing();
              isModelTurnActiveRef.current = false;
              connectionErrored = true;

              const normalizedError =
                err instanceof Error
                  ? err
                  : new Error(
                      "WebSocket connection error. Please verify network access to Google Live services.",
                    );

              if (!transportOpened && !isSessionReadyRef.current && !isReconnect) {
                onErrorRef.current?.(normalizedError);
              }
            },
            onclose: (ev) => {
              if (!isCurrent() || retryOwned) return;
              debugLog("[gemini-live] Closed:", ev);
              if (goAwayTimerRef.current) {
                clearTimeout(goAwayTimerRef.current);
                goAwayTimerRef.current = null;
              }
              clearTurnStallTimer();
              pendingGoAwayRotationRef.current = false;
              isModelTurnActiveRef.current = false;
              wasUserSpeakingRef.current = false;
              wasBargedInRef.current = false;
              setOutputDucking(false);
              sessionRef.current = null;
              setIsListening(false);
              clearProcessing();

              // The SDK rejects the pending connect promise if setup fails.
              if (transportOpened && !setupCompleted) return;

              const isErrorClose =
                connectionErrored || (ev.code !== 1000 && ev.code !== 1005);

              if (
                (isSessionReadyRef.current || isReconnect) &&
                durationRef.current < effectiveLimitRef.current
              ) {
                scheduleRetry(isErrorClose);
              } else {
                finalizeUserTurn();
                finalizeAITurn();
                isSessionReadyRef.current = false;
                isReconnectingRef.current = false;
                if (
                  !isDisconnectingRef.current &&
                  isErrorClose
                ) {
                  setWsStatus("error");
                  onErrorRef.current?.(
                    new Error(
                      `Connection closed unexpectedly (code ${ev.code}): ${ev.reason || "Abnormal closure"}`,
                    ),
                  );
                } else {
                  setWsStatus("closed");
                }
              }
            },
          },
        });

        if (!isCurrent() || retryOwned) {
          session.close();
          return;
        }

        cancelRetry();
        sessionRef.current = session;
        setupCompleted = true;
        isSessionReadyRef.current = true;
        isReconnectingRef.current = false;
        wsStatusRef.current = "open";
        setWsStatus("open");
        if (!isReconnect) {
          sessionStartRef.current = Date.now();
          setActiveTranscript({ speaker: "system", text: "Ready." });
        }

        // Automatically trigger the opening greeting cleanly via ordered clientContent
        // and hold outgoing mic audio past connected.mp3 (~2.06s) so the chime never bleeds in.
        if (!isReconnect) {
          micHoldUntilRef.current = Date.now() + CONNECTED_CHIME_HOLD_MS;
          startProcessing();
          sendSessionTextTurn(sessionRef.current, "Hello", true);
        } else {
          // If the server could not provide a resumption handle, finalize any
          // in-progress turn text and seed recent turns silently so the model
          // stays in context and never re-greets. When resuming with a valid
          // handle, keep in-progress parts open so a sentence split across a
          // GoAway boundary stays a single unbroken transcript entry.
          if (!previousHandleRef.current) {
            finalizeUserTurn();
            finalizeAITurn();
          }
          if (
            !previousHandleRef.current &&
            reconnectHistoryRef.current.length > 0 &&
            typeof sessionRef.current.sendClientContent === "function"
          ) {
            const recentTurns = reconnectHistoryRef.current.map((t) => ({
              role: t.role === "AI" ? "model" : "user",
              parts: [{ text: t.content }],
            }));
            const continuityPart = {
              text: "SYSTEM NOTIFICATION: Connection resumed mid-call. Do NOT greet or re-introduce yourself; continue assisting the user seamlessly when they speak.",
            };
            const lastTurn = recentTurns.at(-1);
            if (lastTurn && lastTurn.role === "user") {
              lastTurn.parts.push(continuityPart);
            } else {
              recentTurns.push({
                role: "user",
                parts: [continuityPart],
              });
            }
            try {
              sessionRef.current.sendClientContent({
                turns: recentTurns,
                turnComplete: false,
              });
            } catch (err) {
              console.warn("[gemini-live] Context re-seed failed:", err);
            }
          }

          // Flush recent user speech captured during the brief rotation handoff,
          // dropping chunks older than 3s so long outages never replay stale audio.
          if (pendingReconnectAudioRef.current.length > 0) {
            const now = Date.now();
            const buffered = pendingReconnectAudioRef.current.filter(
              (chunk) => now - chunk.capturedAt <= MAX_RECONNECT_AUDIO_AGE_MS,
            );
            pendingReconnectAudioRef.current = [];
            for (let i = 0; i < buffered.length; i++) {
              const chunk = buffered[i];
              try {
                sessionRef.current.sendRealtimeInput({
                  audio: {
                    data: chunk.data,
                    mimeType: "audio/pcm;rate=16000",
                  },
                });
                sentAudioSinceEndRef.current = true;
              } catch (err) {
                console.error(
                  "[gemini-live] Reconnect audio replay failed:",
                  err,
                );
                const retryNow = Date.now();
                // A fresh session has none of the audio sent before the failure.
                const retryChunks = previousHandleRef.current
                  ? buffered.slice(i)
                  : buffered;
                pendingReconnectAudioRef.current = retryChunks
                  .filter(
                    (c) => retryNow - c.capturedAt <= MAX_RECONNECT_AUDIO_AGE_MS,
                  )
                  .slice(-MAX_RECONNECT_AUDIO_CHUNKS);
                const failingSession = sessionRef.current;
                sessionRef.current = null;
                isSessionReadyRef.current = false;
                clearProcessing();
                isModelTurnActiveRef.current = false;
                scheduleRetry(true);
                try {
                  failingSession?.close();
                } catch {
                  // Transport may already be closed
                }
                return;
              }
            }
          }
          reconnectAttemptsRef.current = 0;
        }
      } catch (error) {
        if (!isCurrent() || retryOwned) return;
        isSessionReadyRef.current = false;
        isModelTurnActiveRef.current = false;
        clearProcessing();
        console.error("[gemini-live] Connection error:", error);
        if (
          isReconnect &&
          (!transportOpened || setupCompleted) &&
          durationRef.current < effectiveLimitRef.current
        ) {
          scheduleRetry(true);
          return;
        }

        // Clean up audio hardware if initial connection failed
        if (!isReconnect) {
          processorRef.current?.disconnect();
          processorRef.current = null;
          micSinkRef.current?.disconnect();
          micSinkRef.current = null;
          playerNodeRef.current?.disconnect();
          playerNodeRef.current = null;
          highPassRef.current?.disconnect();
          highPassRef.current = null;
          presenceEQRef.current?.disconnect();
          presenceEQRef.current = null;
          limiterRef.current?.disconnect();
          limiterRef.current = null;
          outputTrimRef.current?.disconnect();
          outputTrimRef.current = null;
          lastWorkletAISpeakingRef.current = null;
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }
          if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
          }
        }

        isReconnectingRef.current = false;
        setWsStatus("error");
        setActiveTranscript({ speaker: "system", text: "Failed to connect." });
        onErrorRef.current?.(error);
        if (!isReconnect) {
          throw error;
        }
      }
    },
    [
      cancelRetry,
      getEphemeralToken,
      prefetchEphemeralToken,
      preferedVoice.preferedVoiceId,
      preferedVoice.preferedVoiceName,
      getOrCreateAudioCtx,
      scheduleLevelUpdate,
      setWorkletAISpeaking,
      setOutputDucking,
      startProcessing,
      clearProcessing,
      clearTurnStallTimer,
      finalizeAITurn,
      finalizeUserTurn,
      stopAudio,
      schedulePCMChunk,
    ],
  );

  useEffect(() => {
    connectToGeminiRef.current = connectToGemini;
  }, [connectToGemini]);

  /**
   * Safely terminates all session loops, recording modules, and audio environments.
   */
  const disconnectFromGemini = useCallback(async () => {
    finalizeUserTurn();
    finalizeAITurn();

    noSleep.current.disable();
    isDisconnectingRef.current = true;
    connectionAttemptRef.current += 1;
    isSessionReadyRef.current = false;
    isReconnectingRef.current = false;
    isModelTurnActiveRef.current = false;
    sentAudioSinceEndRef.current = false;
    wasUserSpeakingRef.current = false;
    wasBargedInRef.current = false;
    pendingReconnectAudioRef.current = [];
    micHoldUntilRef.current = 0;
    cancelRetry();

    stopAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (micSinkRef.current) {
      micSinkRef.current.disconnect();
      micSinkRef.current = null;
    }

    if (playerNodeRef.current) {
      playerNodeRef.current.disconnect();
      playerNodeRef.current = null;
    }

    if (highPassRef.current) {
      highPassRef.current.disconnect();
      highPassRef.current = null;
    }
    if (presenceEQRef.current) {
      presenceEQRef.current.disconnect();
      presenceEQRef.current = null;
    }
    if (limiterRef.current) {
      limiterRef.current.disconnect();
      limiterRef.current = null;
    }
    if (outputTrimRef.current) {
      outputTrimRef.current.disconnect();
      outputTrimRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {}
      sessionRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // Clear any cached token and resumption handle from the ended session so future sessions start fresh
    clearCachedToken();
    previousHandleRef.current = null;
    reconnectHistoryRef.current = [];

    wsStatusRef.current = "idle";
    audioStatusRef.current = "idle";
    lastWorkletAISpeakingRef.current = null;
    setWsStatus("idle");
    setAudioStatus("idle");
    setIsListening(false);
    clearProcessing();
    setActiveTranscript(null);
    sessionStartRef.current = 0;
    micLevelRef.current = 0;
    aiAudioLevelRef.current = 0;
    setMicLevel(0);
    setAiAudioLevel(0);
  }, [stopAudio, finalizeUserTurn, finalizeAITurn, cancelRetry, clearCachedToken, clearProcessing]);

  useEffect(() => {
    disconnectFromGeminiRef.current = disconnectFromGemini;
  }, [disconnectFromGemini]);

  const toggleMicMute = useCallback(
    (muted: boolean) => {
      isMicMutedRef.current = muted;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      }
      if (muted) {
        setIsListening(false);
        wasUserSpeakingRef.current = false;
        pendingReconnectAudioRef.current = [];
        if (wasBargedInRef.current) {
          wasBargedInRef.current = false;
          setOutputDucking(false);
        }
        if (
          sentAudioSinceEndRef.current &&
          sessionRef.current &&
          isSessionReadyRef.current
        ) {
          sentAudioSinceEndRef.current = false;
          try {
            sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
          } catch {}
        }
      }
    },
    [setOutputDucking],
  );

  const toggleAudioMute = useCallback((muted: boolean) => {
    isAudioMutedRef.current = muted;
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        muted
          ? 0
          : wasBargedInRef.current
            ? BARGE_IN_OUTPUT_GAIN
            : OUTPUT_GAIN,
        audioCtxRef.current.currentTime,
        0.01,
      );
    }
  }, []);

  const getTranscripts = useCallback(() => {
    finalizeUserTurn();
    finalizeAITurn();
    return allTranscriptsRef.current;
  }, [finalizeUserTurn, finalizeAITurn]);

  // Session duration tracker, triggering buffers and user notifications
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsStatusRef.current === "open" && !isReconnectingRef.current) {
        const next = durationRef.current + 1;
        durationRef.current = next;
        setDuration(next);

        // Trigger saving logic every 10 seconds
        if (next % 10 === 0) {
          syncSessionToBuffer(next);
          heartbeatBuffer(next);
        }

        const limit = effectiveLimitRef.current;
        const endTick = Math.ceil(limit);

        // Proactively pre-warm the next single-use ephemeral token every 8.5m
        // (before Google's ~10m connection rotation) so GoAway hands off with
        // zero token-minting wait.
        if (
          next > 0 &&
          next % RECONNECT_TOKEN_PREWARM_INTERVAL_S === 0 &&
          limit - next > 60
        ) {
          prefetchEphemeralToken(
            limit,
            preferedVoice.preferedVoiceId,
            preferedVoice.preferedVoiceName,
          );
        }

        if (next === endTick - 300 && limit > 600 && limit <= 1800) {
          try {
            const canSpeakNow =
              !isModelTurnActiveRef.current &&
              audioStatusRef.current !== "playing";
            sendSessionTextTurn(
              sessionRef.current,
              "SYSTEM NOTIFICATION: 5 minutes remaining until the session limit. Please inform the user gracefully.",
              canSpeakNow,
            );
          } catch (err) {
            console.error("[gemini-live] 5m warning error:", err);
          }
        }

        if (next === endTick - 120 && limit > 300 && limit <= 1800) {
          try {
            const canSpeakNow =
              !isModelTurnActiveRef.current &&
              audioStatusRef.current !== "playing";
            sendSessionTextTurn(
              sessionRef.current,
              "SYSTEM NOTIFICATION: 2 minutes remaining. Please inform the user and continue your response uninterrupted.",
              canSpeakNow,
            );
          } catch (err) {
            console.error("[gemini-live] 2m warning error:", err);
          }
        }

        if (next === endTick - 10 && limit > 10) {
          try {
            sendSessionTextTurn(
              sessionRef.current,
              "SYSTEM NOTIFICATION: The session limit has been reached. Please gracefully inform the user that time is over, thank them for their time, and warmly invite them to call back if they have any further legal concerns. Be creative and as polite as possible in your final 10 seconds.",
              true,
            );
          } catch (err) {
            console.error("[gemini-live] 10s warning error:", err);
          }
        }

        if (next >= limit) {
          onDurationLimitReached?.();
        }
      }
    }, 1000);

    const wakeLock = noSleep.current;
    return () => {
      clearInterval(interval);
      wakeLock.disable();
    };
  }, [
    onDurationLimitReached,
    syncSessionToBuffer,
    heartbeatBuffer,
    prefetchEphemeralToken,
    preferedVoice.preferedVoiceId,
    preferedVoice.preferedVoiceName,
  ]);

  // Ensure sockets, microphone tracks, and AudioContext are released if the
  // user navigates away via client-side routing during or after a session.
  useEffect(() => {
    return () => {
      if (
        sessionRef.current ||
        mediaStreamRef.current ||
        audioCtxRef.current ||
        reconnectTimerRef.current ||
        goAwayTimerRef.current ||
        processingTimerRef.current ||
        turnStallTimerRef.current ||
        wsStatusRef.current === "open" ||
        wsStatusRef.current === "connecting"
      ) {
        disconnectFromGeminiRef.current?.();
      }
    };
  }, []);

  const prefetchToken = useCallback(() => {
    if (
      wsStatusRef.current === "connecting" ||
      wsStatusRef.current === "open"
    )
      return;
    prefetchEphemeralToken(
      effectiveLimit,
      preferedVoice?.preferedVoiceId,
      preferedVoice?.preferedVoiceName,
    );
  }, [effectiveLimit, preferedVoice, prefetchEphemeralToken]);

  return {
    wsStatus,
    audioStatus,
    isListening,
    isProcessing,
    activeTranscript,
    duration,
    remainingSeconds: Math.max(0, effectiveLimit - duration),
    sessionId,
    connect: connectToGemini,
    disconnect: disconnectFromGemini,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
    prefetchToken,
    clearCachedToken,
    /** RMS mic level 0–1, updated ~30fps */
    micLevel,
    /** RMS AI audio level 0–1, updated ~30fps */
    aiAudioLevel,
  };
};