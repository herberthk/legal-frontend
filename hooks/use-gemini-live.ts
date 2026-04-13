import { useState, useRef, useCallback, useEffect } from "react";
import {
  GoogleGenAI,
  LiveConnectConfig,
  Modality,
  Session,
} from "@google/genai";
import { LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION } from "@/constants/prompt";
import { WORKLET_CODE } from "@/constants/gemini";

const WORKLET_URL = `data:text/javascript;charset=utf-8,${encodeURIComponent(WORKLET_CODE)}`;

export interface UseGeminiLiveOptions {
  userName: string;
  voicePreference: string;
}

export const useGeminiLive = ({
  userName,
  voicePreference,
}: UseGeminiLiveOptions) => {
  const [wsStatus, setWsStatus] = useState<VoiceSessionStatus>("idle");
  const [audioStatus, setAudioStatus] = useState<VoiceAudioStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [activeTranscript, setActiveTranscript] =
    useState<AgentTranscript | null>(null);
  const aiClientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const previousHandleRef = useRef<string | null>(null);
  const isDisconnectingRef = useRef(false);

  // Memory efficient accumulation
  const userPartsRef = useRef<string[]>([]);
  const aiPartsRef = useRef<string[]>([]);
  const allTranscriptsRef = useRef<Transcript[]>([]);

  // Audio Processing Contexts
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const masterGainRef = useRef<GainNode | null>(null);

  // Token cache
  const ephemeralTokenRef = useRef<{ token: string; expiresAt: number } | null>(
    null,
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

    nextStartTimeRef.current = ctx.currentTime;
    return ctx;
  }, []);

  const schedulePCMChunk = useCallback((base64Data: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // Decode Base64 to binary buffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert LINEAR16 to Float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    const SCALING_FACTOR = 1 / 0x8000;

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] * SCALING_FACTOR;
    }

    // 5ms fade-in/out to remove click artifacts at chunk seams
    // At 24kHz, 120 samples is 5ms
    const fade = Math.min(120, Math.floor(float32.length * 0.1));
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

    // Gapless playback scheduling
    if (nextStartTimeRef.current < ctx.currentTime) {
      nextStartTimeRef.current = ctx.currentTime;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    activeSourcesRef.current.add(source);
    setAudioStatus("playing");

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      const now = audioCtxRef.current?.currentTime ?? 0;
      if (nextStartTimeRef.current <= now + 0.05) {
        setAudioStatus("done");
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop(0);
        src.disconnect();
      } catch {
        // Ignore already stopped/disconnected contexts
      }
    }
    activeSourcesRef.current.clear();

    // We do NOT close the AudioContext here, just clear the queued sources
    // so it's ready for the next chunks.
    if (audioCtxRef.current) {
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }
    setAudioStatus("idle");
  }, []);

  const connectToGemini = useCallback(async () => {
    try {
      if (wsStatus === "connecting" || wsStatus === "open") return;
      isDisconnectingRef.current = false;

      setWsStatus("connecting");

      // Initialize audio context to get mic input
      const ctx = getOrCreateAudioCtx(24000); // 24kHz output

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      await ctx.audioWorklet.addModule(WORKLET_URL);
      const source = ctx.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(ctx, "pcm-processor", {
        channelCount: 1,
      });
      processorRef.current = processor;

      const token = await getEphemeralToken();

      // console.log("Token:", token);
      aiClientRef.current = new GoogleGenAI({
        apiKey: token,
        apiVersion: "v1alpha",
      });

      const config: LiveConnectConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voicePreference || "Zephyr",
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // Using context window compression for extended sessions >15 mins
        contextWindowCompression: { slidingWindow: {} },
        systemInstruction: {
          parts: [
            {
              text: LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION({
                user: userName,
                instructor: voicePreference,
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
            setActiveTranscript({ speaker: "system", text: "Ready." });

            // Attach mic input handler
            processor.port.onmessage = (e) => {
              if (isDisconnectingRef.current) return;

              const { pcm, volume, isSpeaking } = e.data;
              setIsListening(isSpeaking);

              if (sessionRef.current) {
                // pcm is an ArrayBuffer (Int16) from the worklet
                const uint8Array = new Uint8Array(pcm);
                let binaryStr = "";
                for (let i = 0; i < uint8Array.length; i++) {
                  binaryStr += String.fromCharCode(uint8Array[i]);
                }
                const base64Audio = btoa(binaryStr);

                sessionRef.current.sendRealtimeInput({
                  audio: {
                    data: base64Audio,
                    mimeType: "audio/pcm;rate=16000",
                  },
                });
              }
            };

            source.connect(processor);
            processor.connect(ctx.destination);
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
              previousHandleRef.current = msg.sessionResumptionUpdate.newHandle;
            }

            // End of goAway signal / graceful stop needed
            if (msg.goAway) {
              console.log(
                "[gemini-live] Received GoAway. Reconnecting gracefully shortly if needed.",
              );
              // For a more robust app, handle graceful reconnect here.
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
            setActiveTranscript({
              speaker: "system",
              text: "Connection error.",
            });
            setWsStatus("error");
          },
          onclose: (ev) => {
            console.log("[gemini-live] Closed:", ev);
            setWsStatus("closed");
          },
        },
      });

      sessionRef.current.sendRealtimeInput({
        text: "Hello",
      });
    } catch (error) {
      console.error("[gemini-live] Connection error:", error);
      setWsStatus("error");
      setActiveTranscript({ speaker: "system", text: "Failed to connect." });
    }
  }, [
    wsStatus,
    getOrCreateAudioCtx,
    getEphemeralToken,
    voicePreference,
    userName,
    finalizeAITurn,
    finalizeUserTurn,
    stopAudio,
    schedulePCMChunk,
  ]);

  const disconnectFromGemini = useCallback(async () => {
    isDisconnectingRef.current = true;

    stopAudio();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (sessionRef.current) {
      // Send natural end to flush buffers
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
  }, [stopAudio]);

  const toggleMicMute = useCallback((muted: boolean) => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      // Flush gemini buffer
      if (muted && sessionRef.current) {
        try {
          // Send an empty message with audio_stream_end essentially to flush vad buffer
          // Not explicitly supported in all SDK versions via object, but helps
        } catch {}
      }
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
    // Ensure any active turn is flushed to the results before returning
    finalizeUserTurn();
    finalizeAITurn();
    return allTranscriptsRef.current;
  }, [finalizeUserTurn, finalizeAITurn]);

  useEffect(() => {
    return () => {
      disconnectFromGemini();
    };
  }, [disconnectFromGemini]);

  return {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    connect: connectToGemini,
    disconnect: disconnectFromGemini,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
  };
};
