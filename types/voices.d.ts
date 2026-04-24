import { Timestamp } from "firebase/firestore";
declare global {
  type Voice =
    // --- Original & Standard Voices ---
    | "Puck" // Conversational, friendly (The Default)
    | "Charon" // Deep, authoritative, resonant
    | "Kore" // Neutral, professional, calm
    | "Fenrir" // Warm, approachable, robust
    | "Aoede" // Bright, clear, expressive
    | "Zephyr" // Bright, clear, expressive

    // --- Expanded & Artistic Voices ---
    | "Terra" // Grounded and soothing
    | "Lyra" // Melodic and gentle
    | "Orion" // Steady and confident
    | "Ursa" // Conversational and warm
    | "Nova" // Modern, versatile, and energetic

    // --- Specialized/Experimental (Model Specific) ---
    | "Pegasus" // Often seen in high-fidelity 3.1 preview tiers
    | "Hydra" // Multi-tonal experimental voice
    | "Leda" // Gentle and youthful
    | "Orus" // Steady and calm
    | "Achernar" // Soft and whisper-quiet
    | "Umbriel"; // Mellow and low-energy

  type VoiceSessionStatus =
    | "idle" // not connected
    | "connecting" // WebSocket opening
    | "open" // connected and active
    | "closed" // cleanly disconnected
    | "error"; // connection error

  type VoiceAudioStatus = "idle" | "playing" | "done";
  type CallStatus =
    | "idle"
    | "listening"
    | "processing"
    | "speaking"
    | "muted"
    | "closed";
  type Speaker = "user" | "ai" | "system";

  interface AgentTranscript {
    speaker: Speaker;
    text: string;
  }

  interface VoiceInterfaceProps {
    wsStatus: VoiceSessionStatus;
    audioStatus: VoiceAudioStatus;
    duration: number;
    isResponding: boolean;
    remainingSeconds: number;
    activeTranscript: AgentTranscript | null;
    onStart: () => void;
    onEnd: () => void;
    isMuted: boolean;
    setIsMuted: (val: boolean) => void;
    isAudioMuted: boolean;
    setIsAudioMuted: (val: boolean) => void;
    userName?: string;
    listening: boolean; // Engine specific listening state
    voiceName?: string;
    freeVoiceSeconds: number;
    isCreditExhausted: boolean;
    /**
     * Post-call stage to show the progress of encoding, uploading, and saving.
     */
    postCallStage:
      | "encoding"
      | "billing"
      | "uploading"
      | "saving"
      | "done"
      | "error"
      | null;
    postCallError: string | undefined;
    /**
     * Encoding progress 0–100.
     */
    encodingProgress: number;
    /**
     * Upload progress 0-100.
     */
    /** RMS mic level 0–1 for canvas visualizer */
    micLevel: number;
    /** RMS AI audio level 0–1 for canvas visualizer */
    aiAudioLevel: number;
    uploadProgress: number;
  }

  type VoicePasona = {
    id: Voice;
    name: string;
    gender: string;
    desc: string;
  };

  interface VoiceSessionBuffer {
    userId: string;
    sessionId: string;
    duration: number;
    transcripts: Transcript[];
    preferedVoice: PreferedVoice;
    userName: string;
    status: string;
    updatedAt: Timestamp;
  }
}

export {};
