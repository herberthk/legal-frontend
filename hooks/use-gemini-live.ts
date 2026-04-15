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

export interface UseGeminiLiveOptions {
  userName: string;
  voicePreference: string;
  userId: string;
}

export const useGeminiLive = ({
  userName,
  voicePreference,
  userId,
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
  const [duration, setDuration] = useState(0);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const isSyncingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

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
            voicePreference,
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
    [userId, userName, voicePreference],
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

  const schedulePCMChunk = useCallback((base64Data: string) => {
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

    // Zero-copy transfer to audio thread
    player.port.postMessage(bytes.buffer, [bytes.buffer]);
    setAudioStatus("playing");
  }, []);

  const stopAudio = useCallback(() => {
    // Tell the player worklet to flush its ring buffer immediately
    if (playerNodeRef.current) {
      playerNodeRef.current.port.postMessage({ command: "endOfAudio" });
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

      // Load worklets from proper file URLs (not data: URIs).
      // Firefox does NOT support data: URIs for audioWorklet.addModule().
      await Promise.all([
        ctx.audioWorklet.addModule("/js/pcm-processor.js"),
        ctx.audioWorklet.addModule("/js/pcm-player-processor.js"),
      ]);

      const source = ctx.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(ctx, "pcm-processor", {
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
            reconnectAttemptsRef.current = 0; // Reset retry counter on success
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
            // processor.connect(ctx.destination);
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
    // Flush any in-progress user/AI transcript segments into allTranscriptsRef
    // BEFORE setting the disconnecting flag. This ensures that partial turns
    // accumulated in userPartsRef/aiPartsRef are not silently dropped when
    // the message handler starts ignoring new events.
    finalizeUserTurn();
    finalizeAITurn();

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
  }, [stopAudio, finalizeUserTurn, finalizeAITurn]);

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

  const wsStatusRef = useRef(wsStatus);
  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsStatusRef.current === "open") {
        setDuration((prev) => {
          const next = prev + 1;
          if (next % 10 === 0) {
            syncSessionToBuffer(next);
          }
          if (next >= 3600) {
            disconnectFromGemini();
          }
          return next;
        });
      }
    }, 1000);

    // Cleanup only clears the interval. Disconnection is handled explicitly
    // by the consumer (e.g. unmount, user action) — not implicitly by effect cleanup.
    return () => clearInterval(interval);

    // wsStatus intentionally excluded. We read it via wsStatusRef.current inside
    // the interval so we always get the latest value without re-subscribing.
  }, [disconnectFromGemini, syncSessionToBuffer]);

  return {
    wsStatus,
    audioStatus,
    isListening,
    activeTranscript,
    duration,
    remainingSeconds: Math.max(0, 3600 - duration),
    sessionId: sessionIdRef.current,
    connect: connectToGemini,
    disconnect: disconnectFromGemini,
    toggleMicMute,
    toggleAudioMute,
    getTranscripts,
  };
};
