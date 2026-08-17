import { GoogleGenAI } from "@google/genai";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { ok, internalError, paymentRequired } from "@/lib/api/v1/response";
import { db } from "@/firebase/admin";
import { COLLECTIONS, COST_PER_VOICE_SECOND_IN_CENTS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Mints a short-lived ephemeral Gemini Live token for the mobile client — the
 * Bearer/App-Check twin of `app/api/gemini-token/route.ts`. The real API key
 * never leaves the server; the client opens a `@google/genai` `live.connect`
 * WebSocket session with this token. See `docs/mobile/skills/voice-chat.md`.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable");
    return internalError("Server configuration error");
  }

  // 1. Credit Check & Reservation: verify user has available voice credit
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(gate.userId).get();
  if (!userDoc.exists) {
    return paymentRequired("User not found");
  }
  const userData = userDoc.data() as User;
  const hasCredit =
    (userData.freeVoiceSeconds ?? 0) > 0 ||
    (userData.balance ?? 0) >= COST_PER_VOICE_SECOND_IN_CENTS;

  if (!hasCredit) {
    return paymentRequired("Insufficient credit for voice session");
  }

  // 2. Pre-create server-authoritative voice session reservation
  const sessionId = crypto.randomUUID();
  const sessionRef = db.collection(COLLECTIONS.VOICE_SESSIONS).doc(sessionId);

  try {
    await sessionRef.set({
      id: sessionId,
      userId: gate.userId,
      status: "ACTIVE",
      createdAt: FieldValue.serverTimestamp(),
      startedAt: FieldValue.serverTimestamp(),
      duration: 0,
      cost: 0,
      transcripts: [],
      title: "New Consultation",
      summary: "",
    });
  } catch (dbErr) {
    console.error("Failed to create voice session reservation:", dbErr);
    return internalError("Failed to initialize voice session");
  }

  // 3. Mint ephemeral token with rollback on failure
  try {
    const ai = new GoogleGenAI({ apiKey });

    // Token expires in 60 minutes, allowing 5 minutes to establish a session.
    const expireTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 5 * 60 * 1000,
    ).toISOString();

    const token = await ai.authTokens.create({
      config: {
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    if (!token || !token.name) {
      throw new Error("Failed to generate ephemeral token");
    }

    return ok({ token: token.name, sessionId });
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    // Roll back reservation so failed token creation does not leave an unusable session
    await sessionRef.delete().catch((delErr) => {
      console.error("Failed to clean up voice session after token error:", delErr);
    });
    return internalError("Failed to create ephemeral token");
  }
}
