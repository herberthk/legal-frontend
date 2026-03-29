// /* eslint-disable @typescript-eslint/no-explicit-any */
// import {
//   GoogleGenAI,
//   LiveServerMessage,
//   Modality,
//   Session,
// } from "@google/genai";
// import { ContextCompressor } from "./compressor";
// import { BASE_SYSTEM_INSTRUCTION, WORKLET_CODE } from "@/constants";

// export const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY as string;
// /**
//  * LIVE API SERVICE (VOICE)
//  */
// export class LiveVoiceService {
//   private inputAudioContext: AudioContext | null = null;
//   private outputAudioContext: AudioContext | null = null;
//   private workletNode: AudioWorkletNode | null = null;
//   private inputSource: MediaStreamAudioSourceNode | null = null;
//   private outputAnalyser: AnalyserNode | null = null;

//   private nextStartTime = 0;
//   private sessionPromise: Promise<Session> | null = null;
//   private stream: MediaStream | null = null;
//   private contextCompressor: ContextCompressor;

//   // Recording State
//   private mediaRecorder: MediaRecorder | null = null;
//   private audioChunks: Blob[] = [];
//   private recordingDestination: MediaStreamAudioDestinationNode | null = null;

//   // Callbacks
//   private onStatusChange: (status: string) => void;
//   private onAudioLevel: (level: number) => void;
//   private onTranscript: (sender: "user" | "model", text: string) => void;
//   private onTokenUsage: (
//     tokens: number,
//     type: "VOICE_IN" | "VOICE_OUT",
//   ) => void;
//   private onError: (error: string) => void;
//   private onVadChange?: (isSpeaking: boolean) => void;
//   private onContextUpdate?: () => void;

//   private voiceName: string;
//   private isClosed = false;
//   private isConnected = false;
//   private isConnecting = false;
//   private keepAliveInterval: NodeJS.Timeout | null = null;

//   // Error tracking & Recovery
//   private retryCount = 0;
//   private maxRetries = 3;

//   constructor(
//     voiceName: string,
//     onStatusChange: (status: string) => void,
//     onAudioLevel: (level: number) => void,
//     onTranscript: (sender: "user" | "model", text: string) => void,
//     onTokenUsage: (tokens: number, type: "VOICE_IN" | "VOICE_OUT") => void,
//     onError: (error: string) => void,
//     onVadChange?: (isSpeaking: boolean) => void,
//     onContextUpdate?: () => void,
//   ) {
//     this.voiceName = voiceName;
//     this.onStatusChange = onStatusChange;
//     this.onAudioLevel = onAudioLevel;
//     this.onTranscript = onTranscript;
//     this.onTokenUsage = onTokenUsage;
//     this.onError = onError;
//     this.onVadChange = onVadChange;
//     this.onContextUpdate = onContextUpdate;
//     this.contextCompressor = new ContextCompressor(API_KEY || "");
//   }

//   private handleOffline = () => {
//     if (this.isClosed) return;
//     console.warn("Browser offline detected");
//     this.onStatusChange("error");
//     // Instead of error, we can trigger a soft disconnect visually
//     // and let the automatic retry logic handle resumption when online
//     this.onError("Internet connection lost. Reconnecting...");
//     this.isConnected = false;
//   };

//   async connect(resume = false) {
//     if (this.isConnecting) return;
//     this.retryCount = 0;
//     this.isClosed = false;
//     this.isConnected = false;

//     // Prepare context for resumption or fresh start
//     if (!resume) {
//       this.contextCompressor.clear();
//     }

//     await this.initiateConnection();
//   }

//   private async initiateConnection() {
//     this.isConnecting = true;
//     this.nextStartTime = 0;
//     this.onStatusChange("connecting");

//     window.addEventListener("offline", this.handleOffline);

//     try {
//       if (!API_KEY) throw new Error("API Key is missing.");

//       const ai = new GoogleGenAI({
//         apiKey: API_KEY,
//         httpOptions: { apiVersion: "v1alpha" },
//       });

//       // Cleanup previous contexts to prevent memory leaks
//       await this.cleanup(true);

//       // Initialize Audio Contexts
//       const AudioContextClass =
//         window.AudioContext || (window as any).webkitAudioContext;
//       this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
//       this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });

//       // Initialize Recording Destination in Output Context to mix both mic and AI
//       this.recordingDestination =
//         this.outputAudioContext.createMediaStreamDestination();

//       // Load Worklet
//       const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
//       const workletUrl = URL.createObjectURL(blob);
//       try {
//         await this.inputAudioContext.audioWorklet.addModule(workletUrl);
//       } catch (e) {
//         console.error("Failed to load worklet:", e);
//         throw new Error("Audio processor failed to initialize.");
//       }

//       // Setup Analyser
//       this.outputAnalyser = this.outputAudioContext.createAnalyser();
//       this.outputAnalyser.fftSize = 256;
//       this.outputAnalyser.connect(this.outputAudioContext.destination);

//       this.stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           channelCount: 1,
//           sampleRate: 16000,
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true,
//         },
//       });

//       if (this.isClosed) {
//         this.cleanup();
//         this.isConnecting = false;
//         return;
//       }

//       // --- CONTEXT INJECTION FOR LONG SESSIONS ---
//       let currentSystemInstruction = BASE_SYSTEM_INSTRUCTION;
//       const historyContext = await this.contextCompressor.getOptimizedContext();

//       if (historyContext && historyContext.length > 20) {
//         currentSystemInstruction += `\n\n# [SESSION RESUMPTION CONTEXT]
//           The following is a summary and recent transcript of the conversation so far.
//           Use this to maintain continuity. Do not greet the user again if the context shows a conversation in progress.
//           \n${historyContext}`;

//         if (this.onContextUpdate) this.onContextUpdate();
//       }
//       // -------------------------------------------

//       this.sessionPromise = ai.live.connect({
//         model: "gemini-2.5-flash-native-audio-preview-12-2025",
//         callbacks: {
//           onopen: async () => {
//             this.isConnecting = false;
//             if (this.isClosed) return;
//             console.log("Live session connected");
//             this.isConnected = true;
//             this.onStatusChange("connected");
//             this.retryCount = 0;

//             // Resume Contexts (Browser Autoplay Policy)
//             try {
//               if (this.inputAudioContext?.state === "suspended")
//                 await this.inputAudioContext.resume();
//               if (this.outputAudioContext?.state === "suspended")
//                 await this.outputAudioContext.resume();
//             } catch (err) {
//               console.warn(err);
//             }

//             // Ensure stream exists before starting worklet
//             if (this.stream) {
//               this.startAudioWorklet(this.stream);
//               this.startRecording(); // Start recording mixed audio
//             }
//             this.startKeepAlive();
//           },
//           onmessage: (message: LiveServerMessage) =>
//             this.handleMessage(message),
//           onerror: (e: any) => {
//             this.isConnecting = false;
//             this.handleError(e);
//           },
//           onclose: (e: any) => {
//             this.isConnecting = false;
//             this.handleClose(e);
//           },
//         },
//         config: {
//           responseModalities: [Modality.AUDIO],
//           systemInstruction: currentSystemInstruction,
//           speechConfig: {
//             voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } },
//           },
//           inputAudioTranscription: {},
//           outputAudioTranscription: {},
//           enableAffectiveDialog: true,
//           proactivity: {
//             proactiveAudio: true,
//           },
//         },
//       });

//       this.sessionPromise.catch((err) => {
//         this.isConnecting = false;
//         this.handleError(err);
//       });
//     } catch (error: unknown) {
//       this.isConnecting = false;
//       this.handleError(error);
//     }
//   }

//   private startRecording() {
//     if (!this.stream || !this.outputAudioContext || !this.recordingDestination)
//       return;

//     if (!this.stream.active) {
//       return;
//     }

//     this.audioChunks = [];
//     try {
//       const micSource = this.outputAudioContext.createMediaStreamSource(
//         this.stream,
//       );
//       micSource.connect(this.recordingDestination);

//       this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
//       this.mediaRecorder.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           this.audioChunks.push(event.data);
//         }
//       };
//       this.mediaRecorder.start();
//       console.log("Recording started...");
//     } catch (e) {
//       console.error("MediaRecorder failed to start", e);
//     }
//   }

//   private startKeepAlive() {
//     if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
//     this.keepAliveInterval = setInterval(() => {
//       if (this.isConnected && !this.isClosed && this.sessionPromise) {
//         const silence = new Float32Array(16);
//         const blob = this.createBlob(silence);
//         this.sessionPromise
//           .then((session) => {
//             if (this.isConnected && !this.isClosed) {
//               try {
//                 session.sendRealtimeInput({ media: blob });
//               } catch (e: unknown) {
//                 console.error("Keep-alive failed", e);
//                 // Silently ignore keep-alive failures
//               }
//             }
//           })
//           .catch(() => {});
//       }
//     }, 15000);
//   }

//   private startAudioWorklet(stream: MediaStream) {
//     if (!this.inputAudioContext || this.isClosed || !stream) return;

//     if (!stream.active) return;

//     try {
//       this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
//       this.workletNode = new AudioWorkletNode(
//         this.inputAudioContext,
//         "pcm-processor",
//       );

//       this.workletNode.port.onmessage = (event) => {
//         if (this.isClosed || !this.isConnected) return;

//         const { pcm, volume, isSpeaking } = event.data;

//         this.onAudioLevel(volume * 2);
//         if (this.onVadChange) this.onVadChange(isSpeaking);

//         if (!isSpeaking) return;

//         const currentRate = this.inputAudioContext?.sampleRate || 48000;
//         const downsampled = this.downsampleTo16k(pcm, currentRate);
//         const pcmBlob = this.createBlob(downsampled);

//         if (this.sessionPromise) {
//           this.sessionPromise
//             .then((session) => {
//               if (this.isConnected && !this.isClosed) {
//                 try {
//                   session.sendRealtimeInput({ media: pcmBlob });
//                 } catch (e: unknown) {
//                   console.error("Keep-alive failed", e);
//                   // Swallow errors here to prevent console spam during network glitches
//                 }
//               }
//             })
//             .catch(() => {});
//         }
//       };

//       this.inputSource.connect(this.workletNode);
//       this.workletNode.connect(this.inputAudioContext.destination);
//     } catch (e) {
//       console.error("Audio Worklet Start Error:", e);
//     }
//   }

//   private handleError(e: any) {
//     if (this.isClosed) return;

//     const errorStr = e.message || e.toString();
//     const isPermissionError =
//       errorStr.includes("permission") || errorStr.includes("403");

//     if (isPermissionError) {
//       console.error("Live API Permission Error:", e);
//       this.onStatusChange("error");
//       this.onError(
//         "Access Denied. Please check your API key billing and permissions.",
//       );
//       this.cleanup();
//       return;
//     }

//     // Recoverable Errors
//     if (this.retryCount < this.maxRetries) {
//       const backoffDelay = Math.min(
//         1000 * Math.pow(2, this.retryCount) + Math.random() * 500,
//         8000,
//       );
//       this.retryCount++;
//       console.warn(
//         `Live API Interruption: ${errorStr}. Retrying in ${backoffDelay}ms (Attempt ${this.retryCount})...`,
//       );

//       // Don't show error modal if we are retrying

//       this.cleanup(true);

//       setTimeout(() => {
//         if (!this.isClosed) {
//           this.initiateConnection();
//         }
//       }, backoffDelay);
//     } else {
//       console.error("Live API Error (Fatal):", e);
//       this.onStatusChange("error");
//       this.onError("Connection failed. Please restart the session.");
//       this.cleanup();
//     }
//   }

//   private handleClose(e: any) {
//     if (this.isClosed) return;
//     this.isConnected = false;

//     // Normal Closure
//     if (e && (e.code === 1000 || e.code === 1005)) {
//       this.onStatusChange("disconnected");
//       this.cleanup();
//       return;
//     }

//     // Abnormal Closure (Network drop, etc)
//     // Treat as a retryable error instead of immediately fatal
//     console.warn(
//       "Session closed abnormally (Code: " + (e ? e.code : "unknown") + ")",
//     );
//     this.handleError(new Error("Session closed unexpectedly"));
//   }

//   private async handleMessage(message: LiveServerMessage) {
//     if (this.isClosed) return;

//     if (message.serverContent?.interrupted) {
//       this.stopAudio();
//       return;
//     }

//     const base64Audio =
//       message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
//     if (base64Audio && this.outputAudioContext) {
//       try {
//         if (this.outputAudioContext.state === "suspended")
//           await this.outputAudioContext.resume();
//         const audioBuffer = await this.decodeAudioData(
//           this.decode(base64Audio),
//           this.outputAudioContext,
//           24000,
//           1,
//         );

//         const currentTime = this.outputAudioContext.currentTime;
//         if (this.nextStartTime < currentTime) {
//           this.nextStartTime = currentTime + 0.05;
//         }

//         const source = this.outputAudioContext.createBufferSource();
//         source.buffer = audioBuffer;

//         if (this.outputAnalyser) source.connect(this.outputAnalyser);
//         else source.connect(this.outputAudioContext.destination);

//         if (this.recordingDestination) {
//           source.connect(this.recordingDestination);
//         }

//         source.start(this.nextStartTime);
//         this.nextStartTime += audioBuffer.duration;
//       } catch (e) {
//         console.error("Audio Decode Error", e);
//       }
//     }

//     const outputTranscript = message.serverContent?.outputTranscription?.text;
//     if (outputTranscript) {
//       this.contextCompressor.addTurn("model", outputTranscript);
//       this.onTranscript("model", outputTranscript);
//       this.onTokenUsage(Math.ceil(outputTranscript.length / 4), "VOICE_OUT");
//     }

//     const inputTranscript = message.serverContent?.inputTranscription?.text;
//     if (inputTranscript) {
//       this.contextCompressor.addTurn("user", inputTranscript);
//       this.onTranscript("user", inputTranscript);
//       this.onTokenUsage(Math.ceil(inputTranscript.length / 4), "VOICE_IN");
//     }
//   }

//   private stopAudio() {
//     if (this.outputAudioContext) {
//       this.nextStartTime = this.outputAudioContext.currentTime;
//     } else {
//       this.nextStartTime = 0;
//     }
//   }

//   async disconnect(): Promise<Blob | null> {
//     this.isClosed = true;
//     this.isConnected = false;
//     let recording: Blob | null = null;

//     if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
//       try {
//         const stopPromise = new Promise<Blob>((resolve) => {
//           this.mediaRecorder!.onstop = () => {
//             resolve(new Blob(this.audioChunks, { type: "audio/webm" }));
//           };
//         });
//         this.mediaRecorder.stop();
//         recording = await stopPromise;
//       } catch (e) {
//         console.error("Error stopping recorder", e);
//       }
//     }

//     if (this.sessionPromise) {
//       try {
//         const session = await this.sessionPromise;
//         await session.close();
//       } catch (e) {}
//     }
//     this.cleanup();
//     return recording;
//   }

//   private async cleanup(isRetry = false) {
//     if (!isRetry) this.isClosed = true;
//     this.isConnected = false;
//     if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);

//     window.removeEventListener("offline", this.handleOffline);

//     if (this.stream) {
//       this.stream.getTracks().forEach((t) => t.stop());
//       this.stream = null;
//     }

//     if (this.workletNode) {
//       this.workletNode.port.onmessage = null;
//       this.workletNode.disconnect();
//     }
//     this.inputSource?.disconnect();
//     this.outputAnalyser?.disconnect();
//     this.recordingDestination?.disconnect();

//     if (this.inputAudioContext && this.inputAudioContext.state !== "closed") {
//       try {
//         await this.inputAudioContext.close();
//       } catch {}
//     }
//     if (this.outputAudioContext && this.outputAudioContext.state !== "closed") {
//       try {
//         await this.outputAudioContext.close();
//       } catch {}
//     }

//     this.inputAudioContext = null;
//     this.outputAudioContext = null;
//     this.sessionPromise = null;
//     this.workletNode = null;
//     this.mediaRecorder = null;
//     this.recordingDestination = null;
//   }

//   // --- Helpers ---

//   private downsampleTo16k(
//     inputData: Float32Array,
//     inputSampleRate: number,
//   ): Float32Array {
//     if (inputSampleRate === 16000) return inputData;
//     const ratio = inputSampleRate / 16000;
//     const newLength = Math.ceil(inputData.length / ratio);
//     const result = new Float32Array(newLength);
//     for (let i = 0; i < newLength; i++) {
//       const offset = i * ratio;
//       const index = Math.floor(offset);
//       const nextIndex = Math.min(index + 1, inputData.length - 1);
//       const weight = offset - index;
//       result[i] =
//         inputData[index] * (1 - weight) + inputData[nextIndex] * weight;
//     }
//     return result;
//   }

//   private createBlob(data: Float32Array) {
//     const int16 = new Int16Array(data.length);
//     for (let i = 0; i < data.length; i++) {
//       const s = Math.max(-1, Math.min(1, data[i]));
//       int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
//     }
//     return {
//       data: this.encode(new Uint8Array(int16.buffer)),
//       mimeType: "audio/pcm;rate=16000",
//     };
//   }

//   private encode(bytes: Uint8Array) {
//     const len = bytes.byteLength;
//     let binary = "";
//     const CHUNK_SIZE = 4096;
//     for (let i = 0; i < len; i += CHUNK_SIZE) {
//       binary += String.fromCharCode.apply(
//         null,
//         // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//         //@ts-ignore
//         bytes.subarray(i, Math.min(i + CHUNK_SIZE, len)),
//       );
//     }
//     return btoa(binary);
//   }

//   private decode(base64: string) {
//     const binaryString = atob(base64);
//     const len = binaryString.length;
//     const bytes = new Uint8Array(len);
//     for (let i = 0; i < len; i++) {
//       bytes[i] = binaryString.charCodeAt(i);
//     }
//     return bytes;
//   }

//   private async decodeAudioData(
//     data: Uint8Array,
//     ctx: AudioContext,
//     sampleRate: number,
//     numChannels: number,
//   ): Promise<AudioBuffer> {
//     const dataInt16 = new Int16Array(data.buffer);
//     const frameCount = dataInt16.length / numChannels;
//     const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
//     for (let channel = 0; channel < numChannels; channel++) {
//       const channelData = buffer.getChannelData(channel);
//       for (let i = 0; i < frameCount; i++) {
//         channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
//       }
//     }
//     return buffer;
//   }
// }
