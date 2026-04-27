import { NextResponse } from "next/server";
import {
  recordVoiceSession,
  summarizeConversation,
} from "@/lib/actions/voice-actions";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

//force to use edge runtime
export const runtime = "edge";

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
      instructor: preferedVoice.preferedVoiceName || "Zephyr",
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

    return NextResponse.json({ success: true, voiceSessionId });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
