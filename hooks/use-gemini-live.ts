import { useState, useRef, useCallback, useEffect } from "react";
import {
  GoogleGenAI,
  LiveConnectConfig,
  Modality,
  Session,
} from "@google/genai";
import { LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION } from "@/constants/prompt";

import { db } from "@/firebase/client";
import { COLLECTIONS } from "@/constants";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import NoSleep from "@zakj/no-sleep";

export interface UseGeminiLiveOptions {
  userName: string;
  preferedVoice: PreferedVoice;
  userId: string;

  /**
   * Called with each user-microphone PCM chunk (Int16 ArrayBuffer, 16 kHz).
   * The buffer is transferred (zero-copy) AFTER the Gemini SDK has finished
   * reading it for sendRealtimeInput — so no additional allocations here.
   * `timestamp` is ms since session start (Date.now() - sessionStart).
   */
  onUserAudioChunk?: (buffer: ArrayBuffer, timestamp: number) => void;

  /**
   * Called with each Gemini AI PCM chunk (Int16 ArrayBuffer, 24 kHz).
   * This buffer is a COPY of the data sent to the player worklet — we cannot
   * share the same buffer between two transferable targets, so one slice is
   * unavoidable. The copy is ~4 KB per chunk.
   * `timestamp` is ms since session start.
   */
  onAIAudioChunk?: (buffer: ArrayBuffer, timestamp: number) => void;

  /**
   * Called exactly when the duration reaches the 30-minute limit.
   * Use this to trigger saving/billing before the hook stops the session.
   */
  onDurationLimitReached?: () => void;
}

export const useGeminiLive = ({
  userName,
  preferedVoice,
  userId,
  onUserAudioChunk,
  onAIAudioChunk,
  onDurationLimitReached,
}: UseGeminiLiveOptions) => {
  const [wsStatus, setWsStatus] = useState<VoiceSessionStatus>("idle");
  const [audioStatus, setAudioStatus] = useState<VoiceAudioStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [activeTranscript, setActiveTranscript] =
    useState<AgentTranscript | null>(null);
  const noSleep = useRef(new NoSleep());
  // ── Audio level state for visualization ──────────────────────────────────
  // These are smoothed RMS values (0–1) sampled into React state.
  // Raw values are stored in refs and throttled to avoid re-render storms.
  const micLevelRef = useRef(0);
  const aiAudioLevelRef = useRef(0);
  const [micLevel, setMicLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);

  // Throttle level updates to ~30fps using rAF batching
  const levelRafRef = useRef<number>(0);
  const scheduleLevelUpdate = useCallback(() => {
    if (levelRafRef.current) return; // already scheduled
    levelRafRef.current = requestAnimationFrame(() => {
      levelRafRef.current = 0;
      setMicLevel(micLevelRef.current);
      setAiAudioLevel(aiAudioLevelRef.current);
      // Decay AI level toward zero when no new chunks arrive
      aiAudioLevelRef.current *= 0.85;
    });
  }, []);
  const aiClientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const previousHandleRef = useRef<string | null>(null);
  const isDisconnectingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const isSyncingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Memory efficient accumulation
  const userPartsRef = useRef<string[]>([]);
  const aiPartsRef = useRef<string[]>([]);
  const allTranscriptsRef = useRef<Transcript[]>([]);

  // Track which transcripts are currently being synced to avoid duplicate writes on retry
  const syncingTranscriptsRef = useRef<Transcript[]>([]);

  // Audio Processing Contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Token cache
  const ephemeralTokenRef = useRef<{ token: string; expiresAt: number } | null>(
    null,
  );

  // ── Recorder callback refs ────────────────────────────────────────────────
  // Stored as refs so that the hot-path callbacks (processor.port.onmessage
  // and schedulePCMChunk) always see the latest function reference without
  // appearing in their useCallback dependency arrays. This prevents the
  // entire connectToGemini callback from being recreated whenever the parent
  // re-renders — which would cause the session to restart unexpectedly.
  const onUserAudioChunkRef = useRef(onUserAudioChunk);
  const onAIAudioChunkRef = useRef(onAIAudioChunk);
  useEffect(() => {
    onUserAudioChunkRef.current = onUserAudioChunk;
  }, [onUserAudioChunk]);
  useEffect(() => {
    onAIAudioChunkRef.current = onAIAudioChunk;
  }, [onAIAudioChunk]);

  /**
   * Wall-clock ms of when the WebSocket 'open' event fired.
   * Used to compute per-chunk timestamps as (Date.now() - sessionStartRef.current).
   * Reset each time connectToGemini runs.
   */
  const sessionStartRef = useRef<number>(0);

  const syncSessionToBuffer = useCallback(
    async (currentDuration: number) => {
      if (isSyncingRef.current || allTranscriptsRef.current.length === 0)
        return;

      try {
        isSyncingRef.current = true;
        // Snapshot what we're about to sync into a dedicated ref BEFORE the await.
        // This means:
        //   a) New transcripts arriving during the async write go into allTranscriptsRef
        //      and are NOT cleared if this sync fails.
        //   b) We only clear exactly what was successfully committed, preventing duplicates.
        syncingTranscriptsRef.current = [...allTranscriptsRef.current];

        const bufferRef = doc(
          db,
          COLLECTIONS.VOICE_SESSION_BUFFERS,
          sessionIdRef.current,
        );

        const snapshot = await getDoc(bufferRef);

        if (!snapshot.exists()) {
          await setDoc(bufferRef, {
            sessionId: sessionIdRef.current,
            userId,
            userName,
            preferedVoice,
            duration: currentDuration,
            transcripts: syncingTranscriptsRef.current,
            updatedAt: serverTimestamp(),
            status: "active",
          });
        } else {
          // Read existing transcripts and append new ones manually.
          // arrayUnion would silently deduplicate identical objects (e.g. user says
          // "Yes" or "Okay" twice), which causes real data loss for short repeated
          // user turns. Manual concatenation preserves every turn.
          const existingTranscripts = Array.isArray(
            snapshot.data()?.transcripts,
          )
            ? (snapshot.data()!.transcripts as Transcript[])
            : [];
          await updateDoc(bufferRef, {
            transcripts: [
              ...existingTranscripts,
              ...syncingTranscriptsRef.current,
            ],
            duration: currentDuration,
            updatedAt: serverTimestamp(),
          });
        }

        // Only clear the transcripts that were CONFIRMED written.
        // Any transcripts that arrived during the awaits above are safely preserved
        // at the front of allTranscriptsRef.current.
        allTranscriptsRef.current = allTranscriptsRef.current.slice(
          syncingTranscriptsRef.current.length,
        );
        syncingTranscriptsRef.current = [];
      } catch (error) {
        console.error("[gemini-live] Sync failed:", error);
        // On failure, do NOT clear allTranscriptsRef. The in-flight batch
        // is abandoned and will be retried on the next sync tick.
        syncingTranscriptsRef.current = [];
      } finally {
        isSyncingRef.current = false;
      }
    },
    [userId, userName, preferedVoice],
  );

  const getEphemeralToken = useCallback(async () => {
    if (
      ephemeralTokenRef.current &&
      Date.now() < ephemeralTokenRef.current.expiresAt - 5000
    ) {
      return ephemeralTokenRef.current.token;
    }

    const res = await fetch("/api/gemini-token");
    if (!res.ok) {
      throw new Error(`Failed to fetch ephemeral token: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    // Token valid for 30 minutes. We'll cache it for 25 mins.
    ephemeralTokenRef.current = {
      token: data.token,
      expiresAt: Date.now() + 25 * 60 * 1000,
    };
    return data.token;
  }, []);

  const finalizeUserTurn = useCallback(() => {
    if (userPartsRef.current.length > 0) {
      const fullText = userPartsRef.current.join("").trim();
      if (fullText) {
        allTranscriptsRef.current.push({ role: "user", content: fullText });
      }
      userPartsRef.current = [];
    }
  }, []);

  const finalizeAITurn = useCallback(() => {
    if (aiPartsRef.current.length > 0) {
      const fullText = aiPartsRef.current.join("").trim();
      if (fullText) {
        allTranscriptsRef.current.push({ role: "AI", content: fullText });
      }
      aiPartsRef.current = [];
    }
  }, []);

  const getOrCreateAudioCtx = useCallback((sampleRate: number) => {
    if (
      audioCtxRef.current &&
      audioCtxRef.current.state !== "closed" &&
      audioCtxRef.current.sampleRate === sampleRate
    ) {
      return audioCtxRef.current;
    }

    audioCtxRef.current?.close().catch(() => {});

    // Explicitly use the type from DOM
    const AudioContextClass =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({
      sampleRate,
      latencyHint: "interactive",
    });

    audioCtxRef.current = ctx;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(ctx.destination);
    masterGainRef.current = gainNode;

    return ctx;
  }, []);

  const schedulePCMChunk = useCallback(
    (base64Data: string) => {
      const player = playerNodeRef.current;
      if (!player) return;

      // Resume context if suspended (e.g. autoplay policy)
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});

      // Decode Base64 → binary → ArrayBuffer, then transfer to player worklet.
      // The ring-buffer worklet handles Int16→Float32 conversion internally and
      // plays samples from a continuous buffer — no chunk boundaries, no clicks.
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // ── Recorder interception (AI audio) ─────────────────────────────────────
      // IMPORTANT: We need two consumers for this data:
      //   1. The player worklet  — receives `bytes.buffer` via a transferable.
      //   2. The recorder worker — needs its own copy because transferring to
      //      the player DETACHES the buffer (byteLength → 0).
      //
      // Decision: `Uint8Array.prototype.slice()` creates a new ArrayBuffer copy
      // (~4 KB per chunk). This is the one unavoidable allocation in the hot path.
      // We cannot use SharedArrayBuffer because it requires COOP/COEP headers
      // which add significant server-config complexity.
      //
      // We create the copy BEFORE the player transfer so `bytes` is still intact.
      if (onAIAudioChunkRef.current) {
        const recordBuf = bytes.slice().buffer; // copy for recorder
        const ts = Date.now() - sessionStartRef.current;
        onAIAudioChunkRef.current(recordBuf, ts);
      }

      // Compute RMS of AI audio chunk for visualizer
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

      // Zero-copy transfer to audio thread (bytes.buffer is detached after this)
      player.port.postMessage(bytes.buffer, [bytes.buffer]);
      setAudioStatus("playing");
    },
    [scheduleLevelUpdate],
  );

  const stopAudio = useCallback(() => {
    // Tell the player worklet to flush its ring buffer immediately
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

  const connectToGemini = useCallback(
    async (isReconnect = false) => {
      try {
        if (!isReconnect && (wsStatus === "connecting" || wsStatus === "open"))
          return;
        isDisconnectingRef.current = false;

        // Only show 'connecting' state on initial start, not during background reconnects.
        // This ensures the user doesn't see a UI jump or hear sounds during the invisible transition.
        if (!isReconnect) {
          setWsStatus("connecting");
        }

        if (!isReconnect) {
          // Prevent the display from sleeping during the voice call
          noSleep.current.enable();
          // Reset all session state for a fresh start
          setDuration(0);
          durationRef.current = 0;
          allTranscriptsRef.current = [];
          syncingTranscriptsRef.current = [];
          userPartsRef.current = [];
          aiPartsRef.current = [];
          setActiveTranscript(null);
          previousHandleRef.current = null;
          sessionIdRef.current = crypto.randomUUID();
        }

        // Initialize audio context to get mic input
        let ctx = audioCtxRef.current;
        let processor = processorRef.current;
        let source: MediaStreamAudioSourceNode | undefined;

        if (!isReconnect) {
          ctx = getOrCreateAudioCtx(24000); // 24kHz output
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              autoGainControl: true,
              noiseSuppression: true,
            },
          });
          mediaStreamRef.current = stream;

          // Load worklets from proper file URLs
          await Promise.all([
            ctx.audioWorklet.addModule("/js/pcm-processor.js"),
            ctx.audioWorklet.addModule("/js/pcm-player-processor.js"),
          ]);

          source = ctx.createMediaStreamSource(stream);
          processor = new AudioWorkletNode(ctx, "pcm-processor", {
            channelCount: 1,
          });
          processorRef.current = processor;

          // Create the ring-buffer player node for click-free audio output
          const playerNode = new AudioWorkletNode(ctx, "pcm-player-processor");
          playerNode.connect(masterGainRef.current || ctx.destination);
          playerNodeRef.current = playerNode;

          // Listen for buffer-drain notifications from the player worklet
          playerNode.port.onmessage = (e) => {
            if (e.data?.type === "bufferEmpty") {
              setAudioStatus("done");
            }
          };
        } else {
          // If reconnecting, ctx and processor already exist.
          if (!ctx || !processor) {
            console.error(
              "[gemini-live] Missing audio context during reconnect.",
            );
            return;
          }
        }

        const token = await getEphemeralToken();

        aiClientRef.current = new GoogleGenAI({
          apiKey: token,
          apiVersion: "v1alpha",
        });

        const config: LiveConnectConfig = {
          responseModalities: [Modality.AUDIO],
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
          // Using context window compression for extended sessions >15 mins
          contextWindowCompression: { slidingWindow: {} },
          systemInstruction: {
            parts: [
              {
                text: LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION({
                  user: userName,
                  instructor: preferedVoice.preferedVoiceName,
                }),
              },
            ],
          },
        };

        if (previousHandleRef.current) {
          config.sessionResumption = { handle: previousHandleRef.current };
        }

        sessionRef.current = await aiClientRef.current.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config,
          callbacks: {
            onopen: () => {
              console.log("[gemini-live] open");
              setWsStatus("open");
              if (!isReconnect) {
                setActiveTranscript({ speaker: "system", text: "Ready." });
              }
              reconnectAttemptsRef.current = 0; // Reset retry counter on success

              // Record session start time for chunk timestamps (only on new calls to preserve sync? Or update it?).
              // For reconnect, the timestamp logic might be slightly offset, but relative times are fine for chunks.
              if (!isReconnect) {
                sessionStartRef.current = Date.now();
              }

              if (processor && source && !isReconnect) {
                source.connect(processor);
              }

              // Attach mic input handler
              if (processor) {
                processor.port.onmessage = (e) => {
                  if (isDisconnectingRef.current) return;

                  const { pcm, volume, isSpeaking } = e.data;
                  setIsListening(isSpeaking);

                  // Feed mic level to visualizer (smoothed)
                  micLevelRef.current = volume;
                  scheduleLevelUpdate();

                  if (sessionRef.current) {
                    // pcm is an ArrayBuffer (Int16 @ 16 kHz) transferred from the
                    // pcm-processor worklet. At this point the main thread owns it.

                    // Build base64 for Gemini. This reads `pcm` but does NOT
                    // transfer/detach it — the Gemini SDK receives a string, not
                    // the buffer. So `pcm` stays valid after sendRealtimeInput.
                    const uint8Array = new Uint8Array(pcm);
                    let binaryStr = "";
                    for (let i = 0; i < uint8Array.length; i++) {
                      binaryStr += String.fromCharCode(uint8Array[i]);
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

                    // ── Recorder interception (user audio) ────────────────────────
                    // NOW transfer `pcm` to the recorder worker.
                    // This is zero-copy: we transfer ownership of the ArrayBuffer
                    // that was handed to us from the worklet. After this line, `pcm`
                    // is detached on the main thread — but we already finished using
                    // it for the Gemini sendRealtimeInput above, so this is safe.
                    //
                    // We only record chunks while the user is actually speaking
                    // (isSpeaking from VAD) to avoid storing silence in IDB and
                    // bloating the WAV file with dead air during listening pauses.
                    // Note: we still send all audio to Gemini (including non-speaking
                    // frames) so Gemini's own VAD functions correctly.
                    if (onUserAudioChunkRef.current && isSpeaking) {
                      const ts = Date.now() - sessionStartRef.current;
                      onUserAudioChunkRef.current(pcm, ts);
                      // `pcm` buffer is now detached — do not use it below this line
                    }
                  }
                };
              }
            },
            onmessage: (msg) => {
              if (isDisconnectingRef.current) return;

              // Handle audio interruption
              if (msg.serverContent?.interrupted) {
                console.log("[gemini-live] Interrupted!");
                finalizeAITurn();
                finalizeUserTurn();
                stopAudio();
              }

              // Save new handles for resumption
              if (msg.sessionResumptionUpdate?.newHandle) {
                previousHandleRef.current =
                  msg.sessionResumptionUpdate.newHandle;
              }

              // End of goAway signal / graceful stop needed
              if (msg.goAway) {
                console.log(
                  "[gemini-live] Received GoAway. Reconnecting gracefully...",
                );
                if (!isDisconnectingRef.current && durationRef.current < 1800) {
                  sessionRef.current?.close(); // Proactively close to trigger seamless reconnect
                }
              }

              // Process parts
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

              if (msg.serverContent?.inputTranscription) {
                const txt = msg.serverContent.inputTranscription.text;
                if (txt) {
                  // If AI was speaking, finalize its turn before starting user output
                  finalizeAITurn();
                  userPartsRef.current.push(txt);
                  const current = userPartsRef.current.join("");
                  // Use activeTranscript for unified UI display
                  setActiveTranscript({ speaker: "user", text: current });
                }
              }

              // Output Transcription
              if (msg.serverContent?.outputTranscription) {
                const txt = msg.serverContent.outputTranscription.text;
                if (txt) {
                  // If User was speaking, finalize its turn before starting AI output
                  finalizeUserTurn();
                  aiPartsRef.current.push(txt);
                  const current = aiPartsRef.current.join("");
                  setActiveTranscript({
                    speaker: "ai",
                    text: current,
                  });
                }
              }

              if (msg.serverContent?.turnComplete) {
                finalizeUserTurn();
                finalizeAITurn();
              }
            },
            onerror: (err) => {
              console.error("[gemini-live] Error:", err);
              sessionRef.current = null;
              if (!isDisconnectingRef.current && durationRef.current < 1800) {
                console.log("[gemini-live] Reconnecting after error...");
                setTimeout(() => connectToGemini(true), 500);
                return;
              }
              setActiveTranscript({
                speaker: "system",
                text: "Connection error.",
              });
              setWsStatus("error");
            },
            onclose: (ev) => {
              console.log("[gemini-live] Closed:", ev);
              sessionRef.current = null;
              if (!isDisconnectingRef.current && durationRef.current < 1800) {
                console.log("[gemini-live] Seamlessly reconnecting...");
                setTimeout(() => connectToGemini(true), 500);
                return;
              }
              setWsStatus("closed");
            },
          },
        });

        if (!isReconnect) {
          sessionRef.current.sendRealtimeInput({
            text: "Hello",
          });
        }
      } catch (error) {
        console.error("[gemini-live] Connection error:", error);
        if (
          isReconnect &&
          !isDisconnectingRef.current &&
          durationRef.current < 1800
        ) {
          setTimeout(() => connectToGemini(true), 2000); // Retry reconnect with delay
          return;
        }
        setWsStatus("error");
        setActiveTranscript({ speaker: "system", text: "Failed to connect." });
      }
    },
    [
      wsStatus,
      getOrCreateAudioCtx,
      getEphemeralToken,
      preferedVoice.preferedVoiceId,
      preferedVoice.preferedVoiceName,
      userName,
      scheduleLevelUpdate,
      finalizeAITurn,
      finalizeUserTurn,
      stopAudio,
      schedulePCMChunk,
    ],
  );

  const disconnectFromGemini = useCallback(async () => {
    // Flush any in-progress user/AI transcript segments into allTranscriptsRef
    // BEFORE setting the disconnecting flag. This ensures that partial turns
    // accumulated in userPartsRef/aiPartsRef are not silently dropped when
    // the message handler starts ignoring new events.
    finalizeUserTurn();
    finalizeAITurn();

    // Disable when the session ends to save user battery
    noSleep.current.disable();
    isDisconnectingRef.current = true;

    stopAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (playerNodeRef.current) {
      playerNodeRef.current.disconnect();
      playerNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (sessionRef.current) {
      try {
        // Note: with GenAI SDK, sendRealtimeInput is supported, but audioStreamEnd may need specific shape
        // if we are using the SDK. We will close directly.
        sessionRef.current.close();
      } catch {}
      sessionRef.current = null;
    }

    // Close audio context last to ensure cleanup is complete
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    setWsStatus("idle");
    setAudioStatus("idle");
    setIsListening(false);
    setActiveTranscript(null);
  }, [stopAudio, finalizeUserTurn, finalizeAITurn]);

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
        muted ? 0 : 1,
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsStatusRef.current === "open") {
        setDuration((prev) => {
          const next = prev + 1;
          if (next % 10 === 0) {
            syncSessionToBuffer(next);
          }
          if (next >= 1800) {
            // Duration limit reached. We call the callback if provided.
            // We NO LONGER call disconnectFromGemini() here automatically,
            // because the consumer (GeminiVoiceConnection) needs to perform
            // its own handleEndCall() logic to ensure billing and saving.
            if (onDurationLimitReached) {
              onDurationLimitReached();
            }
          }
          return next;
        });
      }
    }, 1000);

    // Cleanup only clears the interval. Disconnection is handled explicitly
    // by the consumer (e.g. unmount, user action) — not implicitly by effect cleanup.
    return () => {
      clearInterval(interval);
      noSleep.current.disable();
    };

    // wsStatus intentionally excluded. We read it via wsStatusRef.current inside
    // the interval so we always get the latest value without re-subscribing.
  }, [disconnectFromGemini, syncSessionToBuffer]);

  return {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    duration,
    remainingSeconds: Math.max(0, 1800 - duration),
    sessionId: sessionIdRef.current,
    connect: connectToGemini,
    disconnect: disconnectFromGemini,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
    /** RMS mic level 0–1, updated ~30fps */
    micLevel,
    /** RMS AI audio level 0–1, updated ~30fps */
    aiAudioLevel,
  };
};
