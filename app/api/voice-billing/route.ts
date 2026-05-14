import { NextResponse } from "next/server";
import {
  recordVoiceSession,
  summarizeConversation,
} from "@/lib/actions/voice-actions";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { sendSingleNotification } from "@/lib";

//force to use edge runtime
// export const runtime = "edge";

type RequestBody = {
  userId: string;
  sessionId: string;
  duration: number;
  transcripts: Transcript[];
  preferedVoice: PreferedVoice;
  userName: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      sessionId,
      duration,
      transcripts,
      preferedVoice,
      userName,
    } = body as RequestBody;

    if (!userId || !sessionId || typeof duration !== "number") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Process the summary server-side
    const { title, summary } = await summarizeConversation({
      transcripts: transcripts || [],
      instructor: preferedVoice.preferedVoiceName || "Evelyn",
      user: userName || "User",
    });

    const usage: FirestoreWrite<VoiceSessionUsage, "createdAt"> = {
      userId,
      summary,
      transcripts: transcripts || [],
      sessionId,
      cost: duration * COST_PER_VOICE_SECOND_IN_CENTS,
      duration,
      title,
      audioUrl: "",
      createdAt: FieldValue.serverTimestamp(),
    };

    const voiceSessionId = await recordVoiceSession({ usage });

    // ── Push notification — fire-and-forget ─────────────────────────────────
    const durationMin = Math.floor(duration / 60);
    const durationSec = duration % 60;
    const durationLabel =
      durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

    sendSingleNotification({
      to: userId,
      title: "Your AI Legal Consultation Session is Available",
      message: `Your AI legal consultation session that lasted for (${durationLabel}) is now available.`,
      link: `/dashboard/user/transcripts/${voiceSessionId}`,
    }).catch((err) =>
      console.error("[FCM] Post-call push notification failed:", err),
    );

    return NextResponse.json({ success: true, voiceSessionId });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
