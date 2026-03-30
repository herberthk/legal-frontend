declare global {
  type Voice =
    | "Blake"
    | "Luna"
    | "Dennis"
    | "Sarah"
    | "Hana"
    | "Mark"
    | "Hades"
    | "Theodore"
    | "Abby"
    | "Alex"
    | "Amina"
    | "Ashley"
    | "Brian"
    | "Callum"
    | "Carter"
    | "Celeste"
    | "Chloe"
    | "Claire"
    | "Craig"
    | "Darlene"
    | "Deborah"
    | "Derek"
    | "Edward"
    | "Elliot"
    | "Ethan"
    | "Evan"
    | "Evelyn"
    | "Gareth"
    | "Graham"
    | "Grant"
    | "Hamish"
    | "Hank"
    | "Jake"
    | "James"
    | "Jason"
    | "Jessica"
    | "Kayla"
    | "Kelsey"
    | "Lauren"
    | "Liam"
    | "Loretta"
    | "Malcolm"
    | "Marlene"
    | "Miranda"
    | "Mortimer"
    | "Nate"
    | "Oliver"
    | "Pippa"
    | "Pixie"
    | "Ronald"
    | "Rupert"
    | "Serena"
    | "Simon"
    | "Snik"
    | "Tessa"
    | "Timothy"
    | "Tyler"
    | "Veronica"
    | "Victor"
    | "Victoria"
    | "Vinny"
    | "Wendy";

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
    activeTranscript: AgentTranscript | null;
    currentTranscript: string; // Live transcript from STT

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
  }

  type VoicePasona = {
    id: string;
    name: Voice;
    gender: string;
    desc: string;
  };
}

export {};
