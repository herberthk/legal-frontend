"use client";
import { createAssemblyAISpeechRecognition } from "@/sdk";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

if (typeof window !== "undefined") {
  const hasNativeSupport =
    "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

  if (!hasNativeSupport) {
    const AssemblyAIRecognition = createAssemblyAISpeechRecognition({
      tokenEndpoint: "/api/assemblyai-token",
      sampleRate: 16000,
      chunkSize: 2048,
    });

    SpeechRecognition.applyPolyfill(AssemblyAIRecognition);
  }
}
const Dictaphone = () => {
  const {
    transcript,
    listening,
    finalTranscript,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn&apos;t support speech recognition.</span>;
  }

  if (!isMicrophoneAvailable) {
    return <span>Microphone not available.</span>;
  }

  const start = () =>
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  console.log("transcript", finalTranscript);
  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <p className="text-xs font-medium mb-1 text-gray-100">
        Microphone: {listening ? "on" : "off"}
      </p>
      <div className="flex gap-2">
        {!listening ? (
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={start}
          >
            Start
          </button>
        ) : (
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={SpeechRecognition.stopListening}
          >
            Stop
          </button>
        )}

        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          onClick={resetTranscript}
        >
          Reset
        </button>
      </div>
      <p className="text-white">{transcript}</p>
      {/* <p className="text-white">{finalTranscript}</p> */}
    </div>
  );
};
export default Dictaphone;
