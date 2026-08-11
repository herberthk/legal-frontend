import { NextResponse } from "next/server";
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

type RequestBody = {
  sessionId: string;
  duration: number;
  transcripts: Transcript[];
  preferedVoice?: PreferedVoice;
  userName?: string;
};

export async function POST(req: Request) {
  try {
    // The uid comes from the session cookie, never from the body — this endpoint
    // spends money, and it is also reachable via navigator.sendBeacon (which
    // does send same-origin cookies) so a client-supplied id could bill anyone.
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const { sessionId, duration, transcripts, preferedVoice, userName } =
      body as RequestBody;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // `typeof duration === "number"` is not enough: NaN and Infinity are both
    // numbers, and either one flows straight into the balance arithmetic —
    // `balance - NaN` is NaN, which would write a corrupt balance the user can
    // never spend down. Billing is also monotonic, so an inflated duration is
    // charged for real and cannot be walked back by a later, honest call.
    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      duration > MAX_VOICE_SESSION_SECONDS
    ) {
      return NextResponse.json(
        { error: "Invalid duration" },
        { status: 400 },
      );
    }

    // Whole seconds only — the deduction is per-second and a fractional value
    // would leave sub-cent dust that the idempotency check can never settle.
    const billableDuration = Math.floor(duration);

    const safeTranscripts = Array.isArray(transcripts) ? transcripts : [];

    // Process the summary server-side
    const { title, summary } = await summarizeConversation({
      transcripts: safeTranscripts,
      instructor: preferedVoice?.preferedVoiceName || "Evelyn",
      user: userName || "User",
    });

    const usage: FirestoreWrite<VoiceSessionUsage, "createdAt"> = {
      userId,
      summary,
      transcripts: safeTranscripts,
      sessionId,
      cost: billableDuration * COST_PER_VOICE_SECOND_IN_CENTS,
      duration: billableDuration,
      title,
      audioUrl: "",
      createdAt: FieldValue.serverTimestamp(),
    };

    const voiceSessionId = await recordVoiceSession({ usage });

    return NextResponse.json({ success: true, voiceSessionId });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
