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
    /** Typed connection error kind for the premium error overlay */
    connectionError: { kind: ConnectionErrorKind; rawMessage?: string } | null;
    /** Clears the connectionError and resets wsStatus to idle */
    onClearConnectionError: () => void;
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

  type ConnectionErrorKind =
    | "offline" // navigator.onLine === false
    | "mic_denied" // NotAllowedError / PermissionDeniedError
    | "mic_unavailable" // NotFoundError / no mic device
    | "token_failed" // ephemeral token fetch failed (auth/server issue)
    | "timeout" // connection took > 15 s
    | "generic"; // everything else


    interface UseGeminiLiveOptions {
      /** The name of the user engaging with the AI. */
      userName: string;
      /** The voice configuration chosen by the user. */
      preferedVoice: PreferedVoice;
      /** The unique identifier of the user. */
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
       * Called exactly when the duration reaches the dynamic or 30-minute limit.
       * Use this to trigger saving/billing before the hook stops the session.
       */
      onDurationLimitReached?: () => void;

      /**
       * Called with the new session id the moment a fresh call is starting,
       * before the socket is opened and before any audio can arrive.
       *
       * The hook mints the id itself, so anything keyed by session — the audio
       * recorder above all — has to be told which one to use. Deriving it from
       * the rendered `sessionId` instead does not work: the caller starts the
       * recorder before calling `connect()`, so it would still be holding the
       * *previous* call's id and file its chunks under a session that billing
       * and cleanup know nothing about.
       */
      onSessionStart?: (sessionId: string) => void;
      
      /**
       * The total number of seconds allowed for this session based on balance + free time.
       * Hard capped at 1800 (30 minutes) internally.
       */
      totalAllowedSeconds: number;
  }
}

export {};
