import { FieldValue } from "firebase-admin/firestore";
import { recordVoiceSession } from "@/lib/actions/voice-actions";
import { getUserIdFromRequest } from "@/lib/api/v1/auth";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { buildVoiceBillingBodySchema } from "@/lib/voice/billing-schema";
import { ok, unauthenticated, notFoundError, badRequest, apiError } from "@/lib/api/v1/response";

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
 * Requests whose combined (client + buffer) duration is `0` return `400` before
 * summarization.
 */
const bodySchema = buildVoiceBillingBodySchema({ defaultDurationToZero: true });

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

  const { sessionId, duration, transcripts } = parsed.data;
  const billableDuration = Math.floor(duration);

  try {
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

    const result = await recordVoiceSession({ usage });

    // Never report success for a session that was not billed — the client
    // disarms its retry fallback on success.
    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return notFoundError("Voice session not found.");
      }
      if (result.code === "ZERO_DURATION") {
        return badRequest(result.error);
      }
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
