import { GoogleGenAI } from "@google/genai";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import {
  ok,
  internalError,
  paymentRequired,
  rateLimited,
} from "@/lib/api/v1/response";
import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { checkRateLimit } from "@/lib/rate-limiter";
import {
  buildVoiceLiveConfig,
  buildVoiceAuthTokenConfig,
  GEMINI_LIVE_MODEL,
} from "@/lib/voice/live-config";

/**
 * Mints a short-lived ephemeral Gemini Live token for the mobile client — the
 * Bearer/App-Check twin of `app/api/gemini-token/route.ts`. The real API key
 * and the system instruction prompt never leave the server; the client opens
 * a `@google/genai` `live.connect` WebSocket session with this token.
 *
 * Stateless in Firestore (like `/api/gemini-token`): mints a unique `sessionId`
 * for the call, while the client creates/updates `voiceSessionBuffers/{sessionId}`
 * once connected and settles into `voiceSessions/{sessionId}` via `POST /voice/billing`.
 * See `docs/mobile/skills/voice-chat.md`.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const rateLimit = await checkRateLimit({
    action: "voice_token_uid",
    key: gate.userId,
    maxAttempts: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return rateLimited(
      rateLimit.message || "Too many token requests. Please wait.",
      rateLimit.retryAfterSeconds,
    );
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable");
    return internalError("Server configuration error");
  }

  // 1. Credit Check: verify user has available voice credit
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(gate.userId).get();
  if (!userDoc.exists) {
    return paymentRequired("User not found");
  }
  const userData = userDoc.data() as User;

  // 2. Compute configuration and credit allowances
  // Persona name is derived server-side solely from the allowlisted voiceId.
  const url = new URL(req.url);
  const voiceId =
    (url.searchParams.get("voiceId") ?? "").slice(0, 120) ||
    userData.preferedVoice?.preferedVoiceId;
  const maxSecs = Number(url.searchParams.get("maxSecs"));

  // Build the full LiveConnectConfig — including the system prompt — entirely
  // on the server using the authenticated user's profile.
  const { config, credits } = buildVoiceLiveConfig({
    userName: userData.name || "User",
    preferedVoice: { preferedVoiceId: voiceId },
    freeVoiceSeconds: userData.freeVoiceSeconds,
    balance: userData.balance,
    maxSecs,
  });

  if (credits.allowedSeconds <= 0) {
    return paymentRequired("Insufficient credit for voice session");
  }

  // 3. Mint ephemeral token with server-embedded & locked system instruction,
  // paired with a unique sessionId used for client buffer sync and billing.
  const sessionId = crypto.randomUUID();
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
    return internalError("Failed to create ephemeral token");
  }
}
