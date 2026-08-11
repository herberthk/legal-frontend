import { NextResponse } from "next/server";
import {
  recordVoiceSession,
  summarizeConversation,
} from "@/lib/actions/voice-actions";
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

//force to use edge runtime
// export const runtime = "edge";

type RequestBody = {
  sessionId: string;
  duration: number;
  transcripts: Transcript[];
  preferedVoice: PreferedVoice;
  userName: string;
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

    if (!sessionId || typeof duration !== "number") {
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

    return NextResponse.json({ success: true, voiceSessionId });
  } catch (error) {
    console.error("Error in voice-billing beacon:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 },
    );
  }
}
