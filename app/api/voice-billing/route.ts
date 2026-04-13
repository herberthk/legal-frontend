import { NextResponse } from "next/server";
import {
  recordVoiceSession,
  summarizeConversation,
} from "@/lib/actions/voice-actions";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      userId,
      sessionId,
      duration,
      transcripts,
      voicePreference,
      userName,
    } = body;

    if (!userId || !sessionId || typeof duration !== "number") {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Process the summary server-side
    const { title, summary } = await summarizeConversation({
      transcripts: transcripts || [],
      instructor: voicePreference || "Blake",
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

    await recordVoiceSession({ usage });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
