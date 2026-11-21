import { useState, useRef, useCallback, useEffect } from "react";
import {
  GoogleGenAI,
  LiveConnectConfig,
  Modality,
  Session,
} from "@google/genai";
import { GEMINI_LIVE_API_VERSION, GEMINI_LIVE_MODEL } from "@/lib/voice/live-config";
import NoSleep from "@zakj/no-sleep";

import { createGeminiAudioChain } from "./use-gemini-live/audio-setup";
import {
  claimMicStream,
  detectNativeSampleRate,
  parkMicStream,
} from "./use-gemini-live/mic-stream";
import { useFirebaseSync } from "./use-gemini-live/use-firebase-sync";
import { useEphemeralToken } from "./use-gemini-live/use-ephemeral-token";

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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionAttemptRef = useRef(0);
  const cancelRetry = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);
  const connectToGeminiRef = useRef<
    | ((isReconnect?: boolean, forceTokenRefresh?: boolean) => Promise<void>)
    | null
  >(null);

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

  // Finalizes the current user statement and appends it to transcripts history
  const finalizeUserTurn = useCallback(() => {
    if (userPartsRef.current.length > 0) {
      const fullText = userPartsRef.current.join("").trim();
      if (fullText) {
        allTranscriptsRef.current.push({ role: "user", content: fullText });
      }
      userPartsRef.current = [];
    }
  }, []);

  // Finalizes the current AI statement and appends it to transcripts history
  const finalizeAITurn = useCallback(() => {
    if (aiPartsRef.current.length > 0) {
      const fullText = aiPartsRef.current.join("").trim();
      if (fullText) {
        allTranscriptsRef.current.push({ role: "AI", content: fullText });
      }
      aiPartsRef.current = [];
    }
  }, []);

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
      setAudioStatus("playing");
    },
    [scheduleLevelUpdate],
  );

  const stopAudio = useCallback(() => {
    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ command: "endOfAudio" });
    }
    setAudioStatus("idle");
  }, []);

  const wsStatusRef = useRef(wsStatus);
  const durationRef = useRef(duration);
  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Tell the mic worklet when the AI is audible so it can duck the outgoing
  // stream. Without this the AI hears its own voice back through the mic and
  // holds a conversation with itself — browser echo cancellation doesn't help,
  // because Firefox never uses AudioContext output as its AEC reference.
  // Keyed on audioStatus so it only fires on transitions, not per audio chunk.
  useEffect(() => {
    processorRef.current?.port.postMessage({
      command: "aiSpeaking",
      value: audioStatus === "playing",
    });
  }, [audioStatus]);

  /**
   * Main connection loop to the Gemini WebSockets Live API.
   * Handles initialization, reconnect cycles, VAD streaming, and incoming transcripts.
   */
  const connectToGemini = useCallback(
    async (isReconnect = false, forceTokenRefresh = false) => {
      if (!isReconnect && (wsStatus === "connecting" || wsStatus === "open"))
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
        if (!isCurrent() || retryOwned || durationRef.current >= 1800) return;
        retryOwned = true;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          isSessionReadyRef.current = false;
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
        // Each reconnect MUST mint a fresh token, otherwise the server rejects with 1011 ("Token has been used too many times").
        if (isError) reconnectAttemptsRef.current += 1;
        const delay = isError
          ? Math.min(500 * reconnectAttemptsRef.current, 5000)
          : 500;
        console.log(
          `[gemini-live] Seamlessly reconnecting (attempt ${reconnectAttemptsRef.current})...`,
        );
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (isCurrent()) {
            connectToGeminiRef.current?.(true, true);
          }
        }, delay);
      };

      try {
        isDisconnectingRef.current = false;

        // Reset state only on fresh starts, avoid UI jumps during background reconnects
        if (!isReconnect) {
          isSessionReadyRef.current = false;
          setWsStatus("connecting");
          noSleep.current.enable();
          setDuration(0);
          durationRef.current = 0;
          allTranscriptsRef.current = [];
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
        // Running this concurrently with mic acquisition, worklet downloading & compilation,
        // and AppCheck prevents the multi-second delay before the token request hits the network.
        // Ephemeral tokens are single-use; any reconnect must always fetch a fresh token.
        const shouldForceRefresh = isReconnect || forceTokenRefresh;
        const effectiveLimit = Math.min(totalAllowedSeconds, 1800);
        const tokenPromise = getEphemeralToken(
          shouldForceRefresh,
          effectiveLimit,
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

          // The mic is live and this attempt is still the current one, so the
          // caller's connect timeout can stop making room for a permission
          // dialog and get strict about the network work that is left.
          onMicReadyRef.current?.();

          await Promise.all([
            ctx.audioWorklet.addModule("/js/pcm-processor.js"),
            ctx.audioWorklet.addModule("/js/pcm-player-processor.js"),
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
              ctx.audioWorklet.addModule("/js/pcm-processor.js"),
              ctx.audioWorklet.addModule("/js/pcm-player-processor.js"),
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
              setAudioStatus("done");
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
        const config: LiveConnectConfig = {
          responseModalities: [Modality.AUDIO],
          temperature: 0,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: preferedVoice.preferedVoiceId || "Zephyr",
              },
            },
          },
          tools: [{ googleSearch: {} }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          // Enable session resumption so Gemini issues resumption handles, and resume if a handle exists
          sessionResumption: previousHandleRef.current
            ? { handle: previousHandleRef.current }
            : {},
        };

        const session = await aiClientRef.current.live.connect({
          model: GEMINI_LIVE_MODEL,
          config,
          callbacks: {
            onopen: () => {
              if (!isCurrent() || retryOwned) return;
              transportOpened = true;
              console.log("[gemini-live] transport open");

              if (processor && source && needsAudioSetup)
                source.connect(processor);

              // Setup microphone audio transmission
              if (processor) {
                processor.port.onmessage = (e) => {
                  if (isDisconnectingRef.current) return;
                  const { pcm, volume, isSpeaking } = e.data;
                  setIsListening(isSpeaking);

                  micLevelRef.current = volume;
                  scheduleLevelUpdate();

                  if (sessionRef.current) {
                    const uint8Array = new Uint8Array(pcm);
                    let binaryStr = "";
                    const CHUNK_SIZE = 0x8000;
                    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
                      binaryStr += String.fromCharCode.apply(
                        null,
                        uint8Array.subarray(i, i + CHUNK_SIZE) as unknown as number[],
                      );
                    }
                    const base64Audio = btoa(binaryStr);

                    try {
                      sessionRef.current.sendRealtimeInput({
                        audio: {
                          data: base64Audio,
                          mimeType: "audio/pcm;rate=16000",
                        },
                      });
                    } catch (err) {
                      console.error(
                        "[gemini-live] sendRealtimeInput failed:",
                        err,
                      );
                      if (processorRef.current) {
                        processorRef.current.disconnect();
                        processorRef.current = null;
                      }
                      sessionRef.current = null;
                      setWsStatus("error");
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
                console.log("[gemini-live] Interrupted!");
                finalizeAITurn();
                finalizeUserTurn();
                stopAudio();
              }

              if (msg.sessionResumptionUpdate?.newHandle) {
                previousHandleRef.current =
                  msg.sessionResumptionUpdate.newHandle;
              }

              // Server requested rotation, reconnect seamlessly
              if (msg.goAway) {
                console.log(
                  "[gemini-live] Received GoAway. Reconnecting gracefully...",
                );
                if (!isDisconnectingRef.current && durationRef.current < 1800) {
                  sessionRef.current?.close();
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
            },
            onerror: (err) => {
              if (!isCurrent() || retryOwned) return;
              console.error("[gemini-live] Error:", err);
              sessionRef.current = null;
              setIsListening(false);
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
              console.log("[gemini-live] Closed:", ev);
              sessionRef.current = null;
              setIsListening(false);

              // The SDK rejects the pending connect promise if setup fails.
              if (transportOpened && !setupCompleted) return;

              const isErrorClose =
                connectionErrored || (ev.code !== 1000 && ev.code !== 1005);

              if (
                (isSessionReadyRef.current || isReconnect) &&
                durationRef.current < 1800
              ) {
                scheduleRetry(isErrorClose);
              } else {
                isSessionReadyRef.current = false;
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
        reconnectAttemptsRef.current = 0;
        setWsStatus("open");
        if (!isReconnect) {
          sessionStartRef.current = Date.now();
          setActiveTranscript({ speaker: "system", text: "Ready." });
        }

        // Automatically start the conversation
        if (!isReconnect) {
          sessionRef.current.sendRealtimeInput({ text: "Hello" });
        }
      } catch (error) {
        if (!isCurrent() || retryOwned) return;
        isSessionReadyRef.current = false;
        console.error("[gemini-live] Connection error:", error);
        if (
          isReconnect &&
          (!transportOpened || setupCompleted) &&
          durationRef.current < 1800
        ) {
          scheduleRetry(true);
          return;
        }

        // Clean up audio hardware if initial connection failed
        if (!isReconnect) {
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
          }
          if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
          }
        }

        setWsStatus("error");
        setActiveTranscript({ speaker: "system", text: "Failed to connect." });
        onErrorRef.current?.(error);
        if (!isReconnect) {
          throw error;
        }
      }
    },
    [
      wsStatus,
      cancelRetry,
      getEphemeralToken,
      preferedVoice.preferedVoiceId,
      preferedVoice.preferedVoiceName,
      getOrCreateAudioCtx,
      totalAllowedSeconds,
      scheduleLevelUpdate,
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

    setWsStatus("idle");
    setAudioStatus("idle");
    setIsListening(false);
    setActiveTranscript(null);
    sessionStartRef.current = 0;
    micLevelRef.current = 0;
    aiAudioLevelRef.current = 0;
    setMicLevel(0);
    setAiAudioLevel(0);
  }, [stopAudio, finalizeUserTurn, finalizeAITurn, cancelRetry, clearCachedToken]);

  const toggleMicMute = useCallback((muted: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, []);

  const toggleAudioMute = useCallback((muted: boolean) => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        muted ? 0 : 1.4,
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
      if (wsStatusRef.current === "open") {
        setDuration((prev) => {
          const next = prev + 1;

          // Trigger saving logic every 10 seconds
          if (next % 10 === 0) {
            // syncSessionToBuffer is a no-op when no new transcripts arrived,
            // so it cannot be relied on to prove the call is still alive.
            // The heartbeat refreshes updatedAt regardless, which is what
            // keeps the scheduler from finalizing a live call during silence.
            syncSessionToBuffer(next);
            heartbeatBuffer(next);
          }

          const effectiveLimit = Math.min(totalAllowedSeconds, 1800);

          if (
            next === effectiveLimit - 300 &&
            effectiveLimit > 600 &&
            effectiveLimit <= 1800
          ) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: 5 minutes remaining until the session limit. Please inform the user gracefully.",
              });
            } catch (err) {
              console.error("[gemini-live] 5m warning error:", err);
            }
          }

          if (
            next === effectiveLimit - 120 &&
            effectiveLimit > 300 &&
            effectiveLimit <= 1800
          ) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: 2 minutes remaining. Please inform the user and continue your response uninterrupted.",
              });
            } catch (err) {
              console.error("[gemini-live] 2m warning error:", err);
            }
          }

          if (next === effectiveLimit - 10 && effectiveLimit > 10) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: The session limit has been reached. Please gracefully inform the user that time is over, thank them for their time, and warmly invite them to call back if they have any further legal concerns. Be creative and as polite as possible in your final 10 seconds.",
              });
            } catch (err) {
              console.error("[gemini-live] 10s warning error:", err);
            }
          }

          if (next >= effectiveLimit) {
            if (onDurationLimitReached) onDurationLimitReached();
          }
          return next;
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      noSleep.current.disable();
    };
  }, [
    onDurationLimitReached,
    syncSessionToBuffer,
    heartbeatBuffer,
    totalAllowedSeconds,
  ]);

  const effectiveLimit = Math.min(totalAllowedSeconds, 1800);

  const prefetchToken = useCallback(() => {
    if (wsStatus === "connecting" || wsStatus === "open") return;
    const limit = Math.min(totalAllowedSeconds, 1800);
    prefetchEphemeralToken(
      limit,
      preferedVoice?.preferedVoiceId,
      preferedVoice?.preferedVoiceName,
    );
  }, [wsStatus, totalAllowedSeconds, preferedVoice, prefetchEphemeralToken]);

  return {
    wsStatus,
    audioStatus,
    isListening,
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