import { useState, useRef, useCallback, useEffect } from "react";
import {
  GoogleGenAI,
  LiveConnectConfig,
  Modality,
  Session,
} from "@google/genai";
import { LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION } from "@/constants/prompt";
import NoSleep from "@zakj/no-sleep";

import { createGeminiAudioChain } from "./use-gemini-live/audio-setup";
import { useFirebaseSync } from "./use-gemini-live/use-firebase-sync";
import { useEphemeralToken } from "./use-gemini-live/use-ephemeral-token";

export const useGeminiLive = ({
  userName,
  preferedVoice,
  userId,
  onUserAudioChunk,
  onAIAudioChunk,
  onDurationLimitReached,
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

  const [duration, setDuration] = useState(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  
  // Controls the auto-reconnection loop for dropped or goAway connections
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Transcript memory accumulation
  const userPartsRef = useRef<string[]>([]);
  const aiPartsRef = useRef<string[]>([]);
  const allTranscriptsRef = useRef<Transcript[]>([]);

  // Sub-hooks for modularity
  const { syncSessionToBuffer } = useFirebaseSync({
    sessionId: sessionIdRef.current,
    userId,
    userName,
    preferedVoice,
    allTranscriptsRef,
  });

  const { getEphemeralToken } = useEphemeralToken();

  // --- Audio Processing Contexts ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const playerNodeRef = useRef<AudioWorkletNode | null>(null);

  // --- Extended Audio Chain Refs ---
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceEQRef = useRef<BiquadFilterNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const outputTrimRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Latest callback references to avoid dependency re-renders
  const onUserAudioChunkRef = useRef(onUserAudioChunk);
  const onAIAudioChunkRef = useRef(onAIAudioChunk);

  useEffect(() => {
    onUserAudioChunkRef.current = onUserAudioChunk;
  }, [onUserAudioChunk]);
  
  useEffect(() => {
    onAIAudioChunkRef.current = onAIAudioChunk;
  }, [onAIAudioChunk]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ sampleRate, latencyHint: "interactive" });
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
          bytes.byteLength / 2
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
    [scheduleLevelUpdate]
  );

  const stopAudio = useCallback(() => {
    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ command: "endOfAudio" });
    }
    setAudioStatus("idle");
  }, []);

  const wsStatusRef = useRef(wsStatus);
  const durationRef = useRef(duration);
  useEffect(() => { wsStatusRef.current = wsStatus; }, [wsStatus]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  /**
   * Main connection loop to the Gemini WebSockets Live API.
   * Handles initialization, reconnect cycles, VAD streaming, and incoming transcripts.
   */
  const connectToGemini = useCallback(
    async (isReconnect = false, forceTokenRefresh = false) => {
      try {
        if (!isReconnect && (wsStatus === "connecting" || wsStatus === "open")) return;
        isDisconnectingRef.current = false;

        // Reset state only on fresh starts, avoid UI jumps during background reconnects
        if (!isReconnect) {
          setWsStatus("connecting");
          noSleep.current.enable();
          setDuration(0);
          durationRef.current = 0;
          allTranscriptsRef.current = [];
          userPartsRef.current = [];
          aiPartsRef.current = [];
          setActiveTranscript(null);
          previousHandleRef.current = null;
          sessionIdRef.current = crypto.randomUUID();
          reconnectAttemptsRef.current = 0;
        }

        let ctx = audioCtxRef.current;
        let processor = processorRef.current;
        let source: MediaStreamAudioSourceNode | undefined;

        // Initialize mic and worklet layers
        if (!isReconnect) {
          ctx = getOrCreateAudioCtx(24000);
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
          });
          mediaStreamRef.current = stream;

          await Promise.all([
            ctx.audioWorklet.addModule("/js/pcm-processor.js"),
            ctx.audioWorklet.addModule("/js/pcm-player-processor.js"),
          ]);

          source = ctx.createMediaStreamSource(stream);
          processor = new AudioWorkletNode(ctx, "pcm-processor", { channelCount: 1 });
          processorRef.current = processor;

          const playerNode = new AudioWorkletNode(ctx, "pcm-player-processor");
          playerNode.connect(highPassRef.current || masterGainRef.current || ctx.destination);
          playerNodeRef.current = playerNode;

          playerNode.port.onmessage = (e) => {
            if (e.data?.type === "bufferEmpty") {
              setAudioStatus("done");
            }
          };
        } else {
          if (!ctx || !processor) {
            console.error("[gemini-live] Missing audio context during reconnect.");
            return;
          }
        }

        const shouldForceRefresh = !isReconnect || forceTokenRefresh;
        const token = await getEphemeralToken(shouldForceRefresh);
        if (isDisconnectingRef.current) return;

        aiClientRef.current = new GoogleGenAI({ apiKey: token, apiVersion: "v1alpha" });

        const effectiveLimit = Math.min(totalAllowedSeconds, 1800);
        const limitMinutes = Math.floor(effectiveLimit / 60);
        const limitSeconds = effectiveLimit % 60;
        let durationText = `${limitMinutes} minute${limitMinutes !== 1 ? "s" : ""}`;
        if (limitSeconds > 0) durationText += ` and ${limitSeconds} second${limitSeconds !== 1 ? "s" : ""}`;

        // Initialize Gemini model config
        const config: LiveConnectConfig = {
          responseModalities: [Modality.AUDIO],
          temperature: 0,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: preferedVoice.preferedVoiceId || "Zephyr" } } },
          tools: [{ googleSearch: {} }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          systemInstruction: {
            parts: [{ text: LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION({ user: userName, instructor: preferedVoice.preferedVoiceName, maxDurationText: durationText }) }],
          },
        };

        // Resume an existing session via generated handles
        if (previousHandleRef.current) {
          config.sessionResumption = { handle: previousHandleRef.current };
        }

        const session = await aiClientRef.current.live.connect({
          model: "gemini-3.1-flash-live-preview",
          config,
          callbacks: {
            onopen: () => {
              console.log("[gemini-live] open");
              setWsStatus("open");
              if (!isReconnect) setActiveTranscript({ speaker: "system", text: "Ready." });
              reconnectAttemptsRef.current = 0; // Reset reconnection retry counter 

              if (!isReconnect) sessionStartRef.current = Date.now();
              if (processor && source && !isReconnect) source.connect(processor);

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
                    for (let i = 0; i < uint8Array.length; i++) {
                      binaryStr += String.fromCharCode(uint8Array[i]);
                    }
                    const base64Audio = btoa(binaryStr);

                    try {
                      sessionRef.current.sendRealtimeInput({
                        audio: { data: base64Audio, mimeType: "audio/pcm;rate=16000" },
                      });
                    } catch (err) {
                      console.error("[gemini-live] sendRealtimeInput failed:", err);
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
              if (isDisconnectingRef.current) return;

              if (msg.serverContent?.interrupted) {
                console.log("[gemini-live] Interrupted!");
                finalizeAITurn();
                finalizeUserTurn();
                stopAudio();
              }

              if (msg.sessionResumptionUpdate?.newHandle) {
                previousHandleRef.current = msg.sessionResumptionUpdate.newHandle;
              }

              // Server requested rotation, reconnect seamlessly
              if (msg.goAway) {
                console.log("[gemini-live] Received GoAway. Reconnecting gracefully...");
                if (!isDisconnectingRef.current && durationRef.current < 1800) {
                  sessionRef.current?.close();
                }
              }

              // Route PCM data to playback
              if (msg.serverContent?.modelTurn?.parts) {
                for (const part of msg.serverContent.modelTurn.parts) {
                  if (part.inlineData && part.inlineData?.mimeType?.startsWith("audio/pcm")) {
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
                  setActiveTranscript({ speaker: "user", text: userPartsRef.current.join("") });
                }
              }

              if (msg.serverContent?.outputTranscription) {
                const txt = msg.serverContent.outputTranscription.text;
                if (txt) {
                  finalizeUserTurn();
                  aiPartsRef.current.push(txt);
                  setActiveTranscript({ speaker: "ai", text: aiPartsRef.current.join("") });
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
              setIsListening(false);
              
              if (!isDisconnectingRef.current && durationRef.current < 1800) {
                if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                  console.error(`[gemini-live] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
                  setWsStatus("error");
                  setActiveTranscript({ speaker: "system", text: "Connection error. Please try again." });
                  reconnectAttemptsRef.current = 0;
                  return;
                }
                reconnectAttemptsRef.current += 1;
                const delay = Math.min(500 * reconnectAttemptsRef.current, 5000);
                console.log(`[gemini-live] Reconnecting after error (attempt ${reconnectAttemptsRef.current})...`);
                // eslint-disable-next-line
                setTimeout(() => connectToGemini(true, true), delay);
                return;
              }
              setActiveTranscript({ speaker: "system", text: "Connection error." });
              setWsStatus("error");
            },
            onclose: (ev) => {
              console.log("[gemini-live] Closed:", ev);
              sessionRef.current = null;
              setIsListening(false);
              
              if (!isDisconnectingRef.current && durationRef.current < 1800) {
                const isErrorClose = ev.code !== 1000 && ev.code !== 1005;
                const forceTokenRefresh = isErrorClose || reconnectAttemptsRef.current > 0;

                if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                  console.error(`[gemini-live] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
                  setWsStatus("error");
                  setActiveTranscript({ speaker: "system", text: "Connection lost. Please try again." });
                  reconnectAttemptsRef.current = 0;
                  return;
                }
                
                if (isErrorClose) {
                  reconnectAttemptsRef.current += 1;
                }
                const delay = isErrorClose ? Math.min(500 * reconnectAttemptsRef.current, 5000) : 500;
                console.log(`[gemini-live] Seamlessly reconnecting (attempt ${reconnectAttemptsRef.current})...`);
                // eslint-disable-next-line
                setTimeout(() => connectToGemini(true, forceTokenRefresh), delay);
                return;
              }
              setWsStatus("closed");
            },
          },
        });

        if (isDisconnectingRef.current) {
          session.close();
          return;
        }

        sessionRef.current = session;

        // Automatically start the conversation
        if (!isReconnect) {
          sessionRef.current.sendRealtimeInput({ text: "Hello" });
        }
      } catch (error) {
        console.error("[gemini-live] Connection error:", error);
        if (isReconnect && !isDisconnectingRef.current && durationRef.current < 1800) {
          // eslint-disable-next-line
          setTimeout(() => connectToGemini(true, true), 2000);
          return;
        }
        setWsStatus("error");
        setActiveTranscript({ speaker: "system", text: "Failed to connect." });
      }
    },
    [
      wsStatus,
      getEphemeralToken,
      preferedVoice.preferedVoiceId,
      preferedVoice.preferedVoiceName,
      userName,
      getOrCreateAudioCtx,
      totalAllowedSeconds,
      scheduleLevelUpdate,
      finalizeAITurn,
      finalizeUserTurn,
      stopAudio,
      schedulePCMChunk,
    ],
  );

  /**
   * Safely terminates all session loops, recording modules, and audio environments.
   */
  const disconnectFromGemini = useCallback(async () => {
    finalizeUserTurn();
    finalizeAITurn();

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

    if (highPassRef.current) { highPassRef.current.disconnect(); highPassRef.current = null; }
    if (presenceEQRef.current) { presenceEQRef.current.disconnect(); presenceEQRef.current = null; }
    if (limiterRef.current) { limiterRef.current.disconnect(); limiterRef.current = null; }
    if (outputTrimRef.current) { outputTrimRef.current.disconnect(); outputTrimRef.current = null; }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    setWsStatus("idle");
    setAudioStatus("idle");
    setIsListening(false);
    setActiveTranscript(null);
    micLevelRef.current = 0;
    aiAudioLevelRef.current = 0;
    setMicLevel(0);
    setAiAudioLevel(0);
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
            syncSessionToBuffer(next);
          }

          const effectiveLimit = Math.min(totalAllowedSeconds, 1800);

          if (next === effectiveLimit - 300 && effectiveLimit > 600 && effectiveLimit <= 1800) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: 5 minutes remaining until the session limit. Please inform the user gracefully.",
              });
            } catch (err) { console.error("[gemini-live] 5m warning error:", err); }
          }

          if (next === effectiveLimit - 120 && effectiveLimit > 300 && effectiveLimit <= 1800) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: 2 minutes remaining. Please inform the user and continue your response uninterrupted.",
              });
            } catch (err) { console.error("[gemini-live] 2m warning error:", err); }
          }

          if (next === effectiveLimit - 10 && effectiveLimit > 10) {
            try {
              sessionRef.current?.sendRealtimeInput({
                text: "SYSTEM NOTIFICATION: The session limit has been reached. Please gracefully inform the user that time is over, thank them for their time, and warmly invite them to call back if they have any further legal concerns. Be creative and as polite as possible in your final 10 seconds.",
              });
            } catch (err) { console.error("[gemini-live] 10s warning error:", err); }
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
    totalAllowedSeconds,
  ]);

  const effectiveLimit = Math.min(totalAllowedSeconds, 1800);

  return {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    duration,
    remainingSeconds: Math.max(0, effectiveLimit - duration),
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
