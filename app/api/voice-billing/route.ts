import { NextResponse } from "next/server";
import { z } from "zod";
import {
  recordVoiceSession,
  summarizeConversation,
} from "@/lib/actions/voice-actions";
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import {
  COST_PER_VOICE_SECOND_IN_CENTS,
  MAX_VOICE_SESSION_SECONDS,
} from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

//force to use edge runtime
// export const runtime = "edge";

/**
 * Transcript bounds.
 *
 * Nothing here is a business rule — they exist because the body is attacker
 * controlled and lands in three expensive places: a Gemini summarization call,
 * a Firestore document (hard 1 MiB limit), and the session record the dashboard
 * renders. `duration: 0` is a legitimate payload, so transcript size is NOT
 * covered by the billing check: without a cap, a zero-second session can carry
 * an unbounded transcript array and buy free model calls.
 *
 * 30 minutes of real speech is roughly 100k characters, so the aggregate cap is
 * ~3x headroom over the longest session the duration limit even allows.
 */
const MAX_TRANSCRIPT_ENTRIES = 1_000;
const MAX_TRANSCRIPT_CONTENT_CHARS = 10_000;
const MAX_TRANSCRIPT_TOTAL_CHARS = 300_000;

const transcriptSchema = z.object({
  role: z.enum(["user", "AI"]),
  content: z.string().max(MAX_TRANSCRIPT_CONTENT_CHARS),
});

const bodySchema = z.object({
  /**
   * The sessionId is a Firestore document id: it keys the buffer, the usage
   * record and the session document. A value containing "/" would silently
   * create a nested document (`voiceSessions/a/b/c`) that falls outside the
   * depth-1 match in firestore.rules, so the character set is closed rather
   * than merely non-empty. crypto.randomUUID(), which is what mints these,
   * fits well inside it.
   */
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid sessionId"),

  /**
   * `typeof duration === "number"` is not enough: NaN and Infinity are both
   * numbers, and either one flows straight into the balance arithmetic —
   * `balance - NaN` is NaN, which would write a corrupt balance the user can
   * never spend down. Billing is also monotonic, so an inflated duration is
   * charged for real and cannot be walked back by a later, honest call.
   *
   * Current Zod rejects non-finite numbers on its own; the refine keeps that
   * guarantee independent of the validator's defaults.
   */
  duration: z
    .number()
    .refine((n) => Number.isFinite(n), "duration must be finite")
    .min(0)
    .max(MAX_VOICE_SESSION_SECONDS),

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

  // Display-only, and only ever read as `.preferedVoiceName`. Bounded because
  // it reaches the summarization prompt, not because the value is trusted. The
  // inner fields stay optional deliberately: this endpoint settles money, and a
  // stored voice preference from an older shape must not turn a real session
  // into a 400.
  preferedVoice: z
    .object({
      preferedVoiceId: z.string().max(64).optional(),
      preferedVoiceName: z.string().max(120).optional(),
    })
    .optional(),

  userName: z.string().max(120).optional(),
});

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

    const { sessionId, duration, transcripts, preferedVoice, userName } =
      parsed.data;

    // Whole seconds only — the deduction is per-second and a fractional value
    // would leave sub-cent dust that the idempotency check can never settle.
    const billableDuration = Math.floor(duration);

    // Process the summary server-side
    const { title, summary } = await summarizeConversation({
      transcripts,
      instructor: preferedVoice?.preferedVoiceName || "Evelyn",
      user: userName || "User",
    });

    const usage: FirestoreWrite<VoiceSessionUsage, "createdAt"> = {
      userId,
      summary,
      transcripts,
      sessionId,
      cost: billableDuration * COST_PER_VOICE_SECOND_IN_CENTS,
      duration: billableDuration,
      title,
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
