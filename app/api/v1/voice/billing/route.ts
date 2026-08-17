import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/firebase/admin";
import { recordVoiceSession } from "@/lib/actions/voice-actions";
import { getUserIdFromRequest } from "@/lib/api/v1/auth";
import {
  COLLECTIONS,
  COST_PER_VOICE_SECOND_IN_CENTS,
  MAX_VOICE_SESSION_SECONDS,
} from "@/constants";
import { ok, unauthenticated, badRequest, apiError } from "@/lib/api/v1/response";

/**
 * Mobile voice-billing endpoint — the Bearer twin of
 * `app/api/voice-billing/route.ts`. Settles a completed Gemini Live session.
 *
 * Deliberately does NOT enforce App Check: on the web this is a `sendBeacon`
 * fired on unload; on mobile it is fired from an `AppState` "background"
 * transition, where an App Check token may not be obtainable in time. Billing
 * must be reliable, and `recordVoiceSession` is idempotent + has a server-side
 * finalizer, so we authenticate by Bearer ID token only and let a missed call
 * be recovered. See `docs/mobile/skills/voice-chat.md`.
 *
 * The transcript bounds below mirror the web route exactly — they exist because
 * the body is attacker-controlled and lands in a Gemini summarization call and a
 * Firestore document (1 MiB hard limit). `duration: 0` is legitimate, so a
 * transcript cap is required independently of the duration cap.
 */
const MAX_TRANSCRIPT_ENTRIES = 1_000;
const MAX_TRANSCRIPT_CONTENT_CHARS = 10_000;
const MAX_TRANSCRIPT_TOTAL_CHARS = 300_000;

const transcriptSchema = z.object({
  role: z.enum(["user", "AI"]),
  content: z.string().max(MAX_TRANSCRIPT_CONTENT_CHARS),
});

const bodySchema = z.object({
  // sessionId is a Firestore document id — closed character set so a value with
  // "/" can't create a nested doc outside the depth-1 firestore.rules match.
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid sessionId"),

  // Client duration is optional/telemetry only; server calculates authoritative duration.
  duration: z
    .number()
    .refine((n) => Number.isFinite(n), "duration must be finite")
    .min(0)
    .max(MAX_VOICE_SESSION_SECONDS)
    .optional(),

  transcripts: z
    .array(transcriptSchema)
    .max(MAX_TRANSCRIPT_ENTRIES)
    .refine(
      (list) =>
        list.reduce((total, t) => total + t.content.length, 0) <=
        MAX_TRANSCRIPT_TOTAL_CHARS,
      `transcripts exceed ${MAX_TRANSCRIPT_TOTAL_CHARS} characters in total`,
    )
    .default([]),

  preferedVoice: z
    .object({
      preferedVoiceId: z.string().max(64).optional(),
      preferedVoiceName: z.string().max(120).optional(),
    })
    .optional(),

  userName: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  // Identity comes from the Bearer token, never from the body — this endpoint
  // spends money.
  const userId = await getUserIdFromRequest(req);
  if (!userId) return unauthenticated();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return badRequest("Invalid request body");
  }

  const { sessionId, transcripts } = parsed.data;

  // Retrieve the server-authoritative voice session reservation
  const sessionRef = db.collection(COLLECTIONS.VOICE_SESSIONS).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return badRequest("Voice session reservation not found");
  }

  const sessionData = sessionSnap.data() as VoiceSessionUsage & {
    startedAt?: FirebaseFirestore.Timestamp;
    createdAt?: FirebaseFirestore.Timestamp;
  };

  if (sessionData.userId !== userId) {
    return unauthenticated();
  }

  // Derive duration from server timing / reservation rather than trusting client-supplied duration
  const startTimestamp = sessionData.startedAt || sessionData.createdAt;
  const startMs = startTimestamp?.toDate ? startTimestamp.toDate().getTime() : Date.now();
  const serverElapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const billableDuration = Math.min(serverElapsedSeconds, MAX_VOICE_SESSION_SECONDS);

  const usage: FirestoreWrite<VoiceSessionUsage, "createdAt"> = {
    userId,
    summary: "",
    transcripts,
    sessionId,
    cost: billableDuration * COST_PER_VOICE_SECOND_IN_CENTS,
    duration: billableDuration,
    title: "",
    audioUrl: "",
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    const result = await recordVoiceSession({ usage });

    // Never report success for a session that was not billed — the client
    // disarms its retry fallback on success.
    if (!result.success) {
      console.error("Voice billing failed:", result.error);
      return apiError(
        result.retryable ? 503 : 500,
        "INTERNAL",
        "Failed to process billing",
      );
    }

    return ok({ voiceSessionId: result.voiceSessionId });
  } catch (error) {
    console.error("Error in voice-billing:", error);
    return apiError(500, "INTERNAL", "Failed to process billing");
  }
}
