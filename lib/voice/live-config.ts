import {
  ActivityHandling,
  EndSensitivity,
  Modality,
  StartSensitivity,
  TurnCoverage,
  type CreateAuthTokenConfig,
  type LiveConnectConfig,
} from "@google/genai";

import {
  COST_PER_VOICE_SECOND_IN_CENTS,
  LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION,
  MAX_VOICE_SESSION_SECONDS,
} from "@/constants";
import { voices } from "@/constants/voices";

export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_LIVE_API_VERSION = "v1beta";
export const DEFAULT_VOICE_ID = "Aoede";
export const DEFAULT_VOICE_NAME = "Evelyn";

const VOICE_BY_ID = new Map<string, VoicePasona>(voices.map((v) => [v.id, v]));

function resolveVoicePreference(
  preferedVoiceId?: string,
): { voiceId: string; voiceName: string } {
  const matchedById = VOICE_BY_ID.get((preferedVoiceId ?? "").trim());
  return {
    voiceId: matchedById?.id ?? DEFAULT_VOICE_ID,
    voiceName: matchedById?.name ?? DEFAULT_VOICE_NAME,
  };
}

function sanitizeUserFirstName(rawName?: string | null): string {
  // Strip common honorifics/titles before taking the first name for natural greetings
  const cleaned = (rawName ?? "").replace(/^(dr|mr|mrs|ms|prof|hon)\.?\s+/i, "");
  const firstToken = cleaned.trim().split(/\s+/)[0] ?? "";
  // Strip prompt-injection / markup characters; keep letters, digits, internal apostrophe/hyphen
  const safe = firstToken
    .replace(/[^\p{L}\p{N}'-]/gu, "")
    .replace(/^['-]+|['-]+$/g, "")
    .slice(0, 40);
  return /[\p{L}\p{N}]/u.test(safe) ? safe : "User";
}

export type VoiceLiveProfile = {
  userName?: string | null;
  preferedVoice?: {
    preferedVoiceId?: string;
    /** Accepted for caller compatibility; server derives persona name strictly from allowlisted preferedVoiceId. */
    preferedVoiceName?: string;
  };
  freeVoiceSeconds: number;
  balance: number;
  maxSecs?: number;
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

export function buildClientVoiceLiveConfig({
  preferedVoiceId,
  resumptionHandle,
}: {
  preferedVoiceId?: string;
  resumptionHandle?: string | null;
}): LiveConnectConfig {
  const { voiceId } = resolveVoicePreference(preferedVoiceId);
  return {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: voiceId },
      },
    },
    tools: [{ googleSearch: {} }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        silenceDurationMs: 700,
      },
      activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
      turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
    },
    contextWindowCompression: {
      triggerTokens: "48000",
      slidingWindow: {
        targetTokens: "24000",
      },
    },
    sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
  };
}

export function buildVoiceLiveConfig({
  userName,
  preferedVoice,
  freeVoiceSeconds,
  balance,
  maxSecs,
}: VoiceLiveProfile): {
  config: LiveConnectConfig;
  credits: VoiceLiveCredits;
} {
  const credits = voiceLiveCredits(freeVoiceSeconds, balance);
  if (maxSecs !== undefined && Number.isFinite(maxSecs) && maxSecs > 0) {
    credits.allowedSeconds = Math.min(credits.allowedSeconds, Math.floor(maxSecs));
  }
  const { voiceId, voiceName } = resolveVoicePreference(
    preferedVoice?.preferedVoiceId,
  );
  const firstName = sanitizeUserFirstName(userName);

  return {
    credits,
    config: {
      ...buildClientVoiceLiveConfig({
        preferedVoiceId: voiceId,
      }),
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
  // Resumption belongs to each connection, which may supply a saved handle.
  const tokenConfig = { ...config };
  delete tokenConfig.sessionResumption;
  return {
    // Ephemeral tokens are strictly single-use in Gemini Live. Each WebSocket connection
    // must be initiated with a fresh token. Attempting to connect more than once with the
    // same token causes the server to close with code 1011 ("Token has been used too many times").
    uses: 1,
    expireTime: new Date(now + 60 * 60 * 1000).toISOString(),
    // 35 minutes: covers a full 30-minute call plus a 5-minute reconnect buffer.
    newSessionExpireTime: new Date(now + 35 * 60 * 1000).toISOString(),
    httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
    liveConnectConstraints: {
      model: GEMINI_LIVE_MODEL,
      config: tokenConfig,
    },
    // Empty array locks every field present in liveConnectConstraints.config
    // (including systemInstruction) without adding duplicate FieldMask paths.
    lockAdditionalFields: [],
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
