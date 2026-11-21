import { GoogleGenAI } from "@google/genai";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { ok, internalError, paymentRequired } from "@/lib/api/v1/response";
import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import {
  buildVoiceLiveConfig,
  buildVoiceAuthTokenConfig,
  GEMINI_LIVE_MODEL,
  MOBILE_VOICE_RESERVATION,
} from "@/lib/voice/live-config";

/**
 * Mints a short-lived ephemeral Gemini Live token for the mobile client — the
 * Bearer/App-Check twin of `app/api/gemini-token/route.ts`. The real API key
 * and the system instruction prompt never leave the server; the client opens
 * a `@google/genai` `live.connect` WebSocket session with this token.
 *
 * The system instruction is embedded and locked in the token constraints server-side,
 * ensuring third-party/mobile clients cannot tamper with or inspect the prompt.
 * See `docs/mobile/skills/voice-chat.md`.
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

  // 2. Compute configuration and credit allowances
  const url = new URL(req.url);
  const voiceId =
    (url.searchParams.get("voiceId") ?? "").slice(0, 120) ||
    userData.preferedVoice?.preferedVoiceId;
  const voiceName =
    (url.searchParams.get("voiceName") ?? "").slice(0, 120) ||
    userData.preferedVoice?.preferedVoiceName;
  const maxSecs = Number(url.searchParams.get("maxSecs"));

  // Build the full LiveConnectConfig — including the system prompt — entirely
  // on the server using the authenticated user's profile.
  const { config, credits } = buildVoiceLiveConfig({
    userName: userData.name || "User",
    preferedVoice: { preferedVoiceId: voiceId, preferedVoiceName: voiceName },
    freeVoiceSeconds: userData.freeVoiceSeconds,
    balance: userData.balance,
    maxSecs,
  });

  if (credits.allowedSeconds <= 0) {
    return paymentRequired("Insufficient credit for voice session");
  }

  // 3. Pre-create server-authoritative voice session reservation
  // Tagged with MOBILE_VOICE_RESERVATION so cloud scheduler's syncBufferSessions
  // can recognize and settle it via settleMobileVoice if abandoned.
  const sessionId = crypto.randomUUID();
  const sessionRef = db.collection(COLLECTIONS.VOICE_SESSIONS).doc(sessionId);

  try {
    await sessionRef.set({
      id: sessionId,
      userId: gate.userId,
      status: "ACTIVE",
      reservationType: MOBILE_VOICE_RESERVATION,
      allowedSeconds: credits.allowedSeconds,
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

  // 4. Mint ephemeral token with server-embedded & locked system instruction
  try {
    const ai = new GoogleGenAI({ apiKey });
    const authTokenConfig = buildVoiceAuthTokenConfig(config);

    const token = await ai.authTokens.create({
      config: authTokenConfig,
    });

    if (!token || !token.name) {
      throw new Error("Failed to generate ephemeral token");
    }

    return ok({
      token: token.name,
      sessionId,
      allowedSeconds: credits.allowedSeconds,
      model: GEMINI_LIVE_MODEL,
    });
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    // Roll back reservation so failed token creation does not leave an unusable session
    await sessionRef.delete().catch((delErr) => {
      console.error("Failed to clean up voice session after token error:", delErr);
    });
    return internalError("Failed to create ephemeral token");
  }
}
