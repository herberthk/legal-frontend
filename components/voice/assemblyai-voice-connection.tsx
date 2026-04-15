// "use client";

// import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react"; // Added useMemo
// import { useVoiceSession, useAssemblyAITranscription } from "@/hooks";
// import { useAuthStore } from "@/store";
// import VoiceInterface from "./voice-interface";
// import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants/constants";
// import { logAnalyticsEvent } from "@/firebase/client";

// interface AssemblyAIVoiceConnectionProps {
//   freeVoiceSeconds: number;
//   balance: number;
// }

// const AssemblyAIVoiceConnection: React.FC<AssemblyAIVoiceConnectionProps> = ({
//   freeVoiceSeconds,
//   balance,
// }) => {
//   const userName = useAuthStore((state) => state.user?.name);
//   const uid = useAuthStore((state) => state.user?.id);
//   const [duration, setDuration] = useState(0);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isAudioMuted, setIsAudioMuted] = useState(false);

//   const totalAllowedSeconds = useMemo(() => {
//     return freeVoiceSeconds + balance / COST_PER_VOICE_SECOND_IN_CENTS;
//   }, [freeVoiceSeconds, balance]);

//   const isCreditExhausted = duration >= totalAllowedSeconds;
//   const voice = useAuthStore((state) => state.user?.voicePreference);
//   const [activeTranscript, setActiveTranscript] =
//     useState<AgentTranscript | null>(null);

//   // llmText state removed
//   const [isResponding, setIsResponding] = useState(false);
//   const REMOTE_WEBSOCKET_SERVER = process.env.NEXT_PUBLIC_WEBSOCKET_SERVER;

//   const { wsStatus, audioStatus, connect, disconnect, send } = useVoiceSession({
//     url:
//       typeof window !== "undefined" && window.location.hostname === "localhost"
//         ? `ws://localhost:8000?uid=${uid}`
//         : `wss://${REMOTE_WEBSOCKET_SERVER}?uid=${uid}`,
//     onText: (delta) => {
//       setActiveTranscript((prev) => {
//         const nextText = (prev?.speaker === "ai" ? prev.text : "") + delta;
//         return {
//           speaker: "ai",
//           text: nextText,
//         };
//       });
//     },
//     onInterrupt: () => {
//       setIsResponding(false);
//       resetRef.current();
//     },
//     onAudioDone: () => {
//       setIsResponding(false);
//     },
//     onError: (msg) => {
//       setIsResponding(false);
//       resetRef.current();
//       setActiveTranscript({
//         speaker: "system",
//         text: `Error: ${msg}`,
//       });
//     },
//     onDuration: (d) => setDuration(d),
//     isAudioMuted,
//   });

//   const resetRef = useRef<() => void>(() => {});

//   const {
//     transcript: aiTranscript,
//     isRecording: aiIsRecording,
//     start: startAiStt,
//     stop: stopAiStt,
//     isConnecting: isSttConnecting,
//     error: transcriptError,
//     reset,
//   } = useAssemblyAITranscription({
//     onTurnEnd: useCallback(
//       (text: string) => {
//         // Stabilized handleTurnEnd
//         setIsResponding(true);
//         setActiveTranscript({
//           speaker: "user",
//           text: text,
//         });
//         send(text);
//         resetRef.current();
//       },
//       [send],
//     ), // Dependencies for useCallback
//     onError: (err) => console.error("[stt]", err),
//   });

//   resetRef.current = reset;

//   const computedWsStatus: VoiceSessionStatus = useMemo(() => {
//     // Memoized status
//     if (wsStatus === "error" || transcriptError) return "error";
//     if (wsStatus === "open" && (aiIsRecording || isMuted)) return "open";
//     if (wsStatus === "connecting" || isSttConnecting) return "connecting";
//     return wsStatus;
//   }, [wsStatus, transcriptError, aiIsRecording, isMuted, isSttConnecting]);

//   useEffect(() => {
//     if (wsStatus === "open") {
//       setActiveTranscript({
//         speaker: "system",
//         text: "Getting things ready...",
//       });
//     }
//   }, [wsStatus]);

//   useEffect(() => {
//     if (transcriptError) {
//       setActiveTranscript({
//         speaker: "system",
//         text: `Transcription Error: ${transcriptError}`,
//       });
//     }
//   }, [transcriptError]);

//   // llmText useEffect removed

//   const handleStartCall = useCallback(async () => {
//     // Stabilized handleStartCall
//     if (
//       wsStatus === "connecting" ||
//       wsStatus === "open" ||
//       aiIsRecording ||
//       isSttConnecting ||
//       isCreditExhausted
//     )
//       return;
//     await startAiStt();
//     connect();
//     logAnalyticsEvent("voice_call_start", { engine: "assemblyai" });
//   }, [
//     wsStatus,
//     aiIsRecording,
//     isSttConnecting,
//     startAiStt,
//     connect,
//     isCreditExhausted,
//   ]);

//   const handleEndCall = useCallback(async () => {
//     disconnect();
//     await stopAiStt();
//     logAnalyticsEvent("voice_call_end", { engine: "assemblyai", duration });
//     setActiveTranscript({
//       speaker: "system",
//       text: "Call ended by you",
//     });
//     reset();
//   }, [disconnect, stopAiStt, reset, duration]);

//   useEffect(() => {
//     if (isCreditExhausted && wsStatus === "open") {
//       handleEndCall();
//     }
//   }, [isCreditExhausted, wsStatus, handleEndCall]);

//   // Handle Microphone Mute (AssemblyAI)
//   // useEffect(() => {
//   //   if (wsStatus === "open") {
//   //     if (isMuted) {
//   //       stopAiStt();
//   //     } else {
//   //       startAiStt();
//   //     }
//   //   }
//   //   // eslint-disable-next-line react-hooks/exhaustive-deps
//   // }, [isMuted, wsStatus]);
//   return (
//     <VoiceInterface
//       wsStatus={computedWsStatus}
//       audioStatus={audioStatus}
//       duration={duration}
//       isResponding={isResponding}
//       activeTranscript={activeTranscript}
//       remainingSeconds={0}
//       // currentTranscript={aiTranscript}
//       onStart={handleStartCall}
//       onEnd={handleEndCall}
//       isMuted={isMuted}
//       setIsMuted={setIsMuted}
//       isAudioMuted={isAudioMuted}
//       setIsAudioMuted={setIsAudioMuted}
//       userName={userName}
//       listening={aiIsRecording}
//       voiceName={voice}
//       freeVoiceSeconds={freeVoiceSeconds}
//       isCreditExhausted={isCreditExhausted}
//     />
//   );
// };

// export default memo(AssemblyAIVoiceConnection);
