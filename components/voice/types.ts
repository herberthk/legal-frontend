export type CallStatus = "idle" | "listening" | "processing" | "speaking";
export type Speaker = "user" | "ai" | "system";

export interface Transcript {
  speaker: Speaker;
  text: string;
}
