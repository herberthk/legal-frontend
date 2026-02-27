/* -------------------------------------------------- */
/*                     ENUMS                          */
/* -------------------------------------------------- */

type VoiceId =
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

type ModelId = "inworld-tts-1.5-mini" | "inworld-tts-1.5-max";

type AudioEncoding =
  | "OGG_OPUS"
  | "MP3"
  | "LINEAR16"
  | "ALAW"
  | "MULAW"
  | "FLAC";

/* -------------------------------------------------- */
/*                     TYPES                          */
/* -------------------------------------------------- */

export interface InworldConfig {
  apiKey: string;
  voiceId: VoiceId;
  modelId?: ModelId;
  encoding?: AudioEncoding;
  sampleRate?: number;
  bitRate?: number;
  autoReconnect?: boolean;
  debug?: boolean;
}

export type AudioCallback = (audioChunk: Buffer) => void;
