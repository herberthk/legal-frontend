import {
  Modality,
  type CreateAuthTokenConfig,
  type LiveConnectConfig,
} from "@google/genai";

import {
  COST_PER_VOICE_SECOND_IN_CENTS,
  LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION,
  MAX_VOICE_SESSION_SECONDS,
} from "@/constants";

export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_LIVE_API_VERSION = "v1beta";

export type VoiceLiveProfile = {
  userName: string;
  preferedVoice?: {
    preferedVoiceId?: string;
    preferedVoiceName?: string;
  };
  freeVoiceSeconds: number;
  balance: number;
};

export type VoiceLiveCredits = {
  freeVoiceSeconds: number;
  balance: number;
  allowedSeconds: number;
};

function finiteNonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function voiceLiveCredits(
  freeVoiceSeconds: number | undefined,
  balance: number | undefined,
): VoiceLiveCredits {
  const free = finiteNonNegative(freeVoiceSeconds);
  const paidBalance = finiteNonNegative(balance);
  const paidSeconds = Math.floor(
    paidBalance / COST_PER_VOICE_SECOND_IN_CENTS,
  );

  return {
    freeVoiceSeconds: free,
    balance: paidBalance,
    allowedSeconds: Math.min(
      MAX_VOICE_SESSION_SECONDS,
      Math.max(0, Math.floor(free) + paidSeconds),
    ),
  };
}

function durationText(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteText = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (seconds === 0) return minuteText;
  return `${minuteText} and ${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function buildVoiceLiveConfig({
  userName,
  preferedVoice,
  freeVoiceSeconds,
  balance,
}: VoiceLiveProfile): {
  config: LiveConnectConfig;
  credits: VoiceLiveCredits;
} {
  const credits = voiceLiveCredits(freeVoiceSeconds, balance);
  const voiceId = preferedVoice?.preferedVoiceId?.trim() || "Aoede";
  const voiceName = preferedVoice?.preferedVoiceName?.trim() || "Evelyn";
  const firstName = userName.trim().split(/\s+/)[0] || "User";

  return {
    credits,
    config: {
      responseModalities: [Modality.AUDIO],
      temperature: 0,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceId },
        },
      },
      tools: [{ googleSearch: {} }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: {},
      systemInstruction: {
        parts: [
          {
            text: LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION({
              user: firstName,
              instructor: voiceName,
              maxDurationText: durationText(credits.allowedSeconds),
            }),
          },
        ],
      },
    },
  };
}

export function buildVoiceAuthTokenConfig(
  config: LiveConnectConfig,
  now = Date.now(),
): CreateAuthTokenConfig {
  return {
    uses: 1,
    expireTime: new Date(now + 60 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 5 * 60 * 1000).toISOString(),
    httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
    liveConnectConstraints: {
      model: GEMINI_LIVE_MODEL,
      config,
    },
  };
}

export type VoiceTokenContract = {
  token: string;
  model: typeof GEMINI_LIVE_MODEL;
  apiVersion: typeof GEMINI_LIVE_API_VERSION;
  config: LiveConnectConfig;
  credits: VoiceLiveCredits;
};

export function voiceTokenContract(
  token: string,
  config: LiveConnectConfig,
  credits: VoiceLiveCredits,
): VoiceTokenContract {
  return {
    token,
    model: GEMINI_LIVE_MODEL,
    apiVersion: GEMINI_LIVE_API_VERSION,
    config,
    credits,
  };
}
