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
     * True while the recorder worker is assembling + encoding the WAV.
     * Used to show a "Preparing download…" overlay after the call ends.
     */
    isEncoding: boolean;
    /**
     * Encoding progress 0–100. Drives the progress bar in the download overlay.
     * Only meaningful when isEncoding = true.
     */
    encodingProgress: number;
  }

  type VoicePasona = {
    id: Voice;
    name: string;
    gender: string;
    desc: string;
  };
}

export {};
