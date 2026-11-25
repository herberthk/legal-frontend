import { NextResponse } from "next/server";
import { recordVoiceSession } from "@/lib/actions/voice-actions";
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { buildVoiceBillingBodySchema } from "@/lib/voice/billing-schema";
import { FieldValue } from "firebase-admin/firestore";

//force to use edge runtime
// export const runtime = "edge";

/**
 * Effective `duration: 0` sessions (when neither body nor buffer has billable
 * seconds) are rejected with 400 before summarization, while a real buffer
 * may still be settled even if a beacon sends `duration: 0`.
 */
const bodySchema = buildVoiceBillingBodySchema({ defaultDurationToZero: false });

export async function POST(req: Request) {
  try {
    // The uid comes from the session cookie, never from the body — this endpoint
    // spends money, and it is also reachable via navigator.sendBeacon (which
    // does send same-origin cookies) so a client-supplied id could bill anyone.
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate the whole body before anything reads it. A cast only describes
    // the shape at compile time; the beacon and the fetch both post JSON that
    // never passed through the type system.
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { sessionId, duration, transcripts } = parsed.data;

    // Whole seconds only — the deduction is per-second and a fractional value
    // would leave sub-cent dust that the idempotency check can never settle.
    const billableDuration = Math.floor(duration);

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

    // Never report success for a session that was not billed. The client treats
    // `{ success: true }` as settled: it sets billingSettledRef and clears its
    // sessionStorage state, disarming the unload beacon that would otherwise
    // have retried. A failure reply keeps that fallback armed, and the buffer is
    // still on disk for the scheduler to finalize.
    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Voice session not found" },
          { status: 404 },
        );
      }
      if (result.code === "ZERO_DURATION") {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      console.error("Voice billing failed:", result.error);
      return NextResponse.json(
        { error: "Failed to process billing" },
        { status: result.retryable ? 503 : 500 },
      );
    }

    return NextResponse.json({
      success: true,
      voiceSessionId: result.voiceSessionId,
    });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
