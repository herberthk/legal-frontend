import { z } from "zod";
import { MAX_VOICE_SESSION_SECONDS } from "@/constants";

/**
 * Shared transcript and request-body bounds for `/api/voice-billing` and
 * `/api/v1/voice/billing`. Kept in one module so web cookie and mobile Bearer
 * endpoints enforce the exact same validation contract.
 */
export const MAX_TRANSCRIPT_ENTRIES = 1_000;
export const MAX_TRANSCRIPT_CONTENT_CHARS = 10_000;
export const MAX_TRANSCRIPT_TOTAL_CHARS = 300_000;

export const voiceTranscriptSchema = z.object({
  role: z.enum(["user", "AI"]),
  content: z.string().max(MAX_TRANSCRIPT_CONTENT_CHARS),
});

export function buildVoiceBillingBodySchema({
  defaultDurationToZero = false,
}: {
  defaultDurationToZero?: boolean;
} = {}) {
  const durationSchema = z
    .number()
    .refine((n) => Number.isFinite(n), "duration must be finite")
    .min(0)
    .max(MAX_VOICE_SESSION_SECONDS);

  return z.object({
    // sessionId is a Firestore document id — closed character set so a value with
    // "/" cannot create a nested doc outside the depth-1 firestore.rules match.
    sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid sessionId"),
    duration: defaultDurationToZero ? durationSchema.default(0) : durationSchema,
    transcripts: z
      .array(voiceTranscriptSchema)
      .max(MAX_TRANSCRIPT_ENTRIES)
      .refine(
        (list) =>
          list.reduce((total, t) => total + t.content.length, 0) <=
          MAX_TRANSCRIPT_TOTAL_CHARS,
        `transcripts exceed ${MAX_TRANSCRIPT_TOTAL_CHARS} characters in total`,
      )
      .default([]),

    // Accepted for backward compatibility with older cached clients, but ignored:
    // `recordVoiceSession` reads authoritative `name` and `preferedVoice` from `users/{uid}`.
    preferedVoice: z
      .object({
        preferedVoiceId: z.string().max(64).optional(),
        preferedVoiceName: z.string().max(120).optional(),
      })
      .optional(),

    userName: z.string().max(120).optional(),
  });
}
