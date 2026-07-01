// Shared types for the Demo modal components

export interface ScriptStep {
  id: string;
  topicColor: string;
  topicLabel: string;
  question: string;
  answer: React.ReactNode;
  voiceDuration: number;
  citations: string[];
  confidence: number;
}



export type Message =
  | { role: "user"; content: string }
  | { role: "ai"; content: ScriptStep };

export type SimStatus =
  | "idle"
  | "typing"
  | "processing"
  | "responding"
  | "done";

/** Maps a topic colour key to its active-tab Tailwind classes */
export const TOPIC_COLOR_MAP: Record<string, string> = {
  orange:
    "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
  indigo:
    "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800",
  emerald:
    "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
};
