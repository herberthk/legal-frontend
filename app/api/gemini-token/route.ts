import { getCurrentUser } from "@/lib/actions/auth";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import {
  buildVoiceLiveConfig,
  buildVoiceAuthTokenConfig,
} from "@/lib/voice/live-config";

// export const runtime = "edge";

/**
 * Mints a short-lived Gemini Live ephemeral token for the web client.
 *
 * The system prompt (`systemInstruction`) is embedded **server-side** inside
 * the token's `liveConnectConstraints` and locked via `lockAdditionalFields`.
 * It is never transmitted to the browser — only the opaque token string reaches
 * the client, so the prompt cannot be read from the network tab or JS bundle.
 *
 * Optional query param:
 *   ?maxSecs=<number>  — an optional lower cap on the user's profile allowance.
 *                        The server caps all sessions at 1800 seconds.
 */
export async function GET(req: Request) {
  try {
    const [appCheckResult, user] = await Promise.all([
      verifyAppCheckHeader(req),
      getCurrentUser(),
    ]);

    if (!appCheckResult.valid) {
      return NextResponse.json(
        { error: appCheckResult.error || "Unauthorized client application" },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Optional overrides: hook forwards UI-selected voice and computed maxSecs
    const url = new URL(req.url);
    const voiceId =
      (url.searchParams.get("voiceId") ?? "").slice(0, 120) ||
      user.preferedVoice?.preferedVoiceId;
    const voiceName =
      (url.searchParams.get("voiceName") ?? "").slice(0, 120) ||
      user.preferedVoice?.preferedVoiceName;
    const maxSecs = Number(url.searchParams.get("maxSecs"));

    // Build the full LiveConnectConfig — including the system prompt — entirely
    // on the server using the authenticated user's profile and voice overrides.
    const { config } = buildVoiceLiveConfig({
      userName: user.name,
      preferedVoice: { preferedVoiceId: voiceId, preferedVoiceName: voiceName },
      freeVoiceSeconds: user.freeVoiceSeconds,
      balance: user.balance,
      maxSecs,
    });

    // Wrap the LiveConnectConfig in an auth token with the system prompt locked
    // server-side. The client calls live.connect() with the remaining fields
    // (voice, modalities, transcription…); systemInstruction is ignored if
    // the client supplies it because lockAdditionalFields prevents override.
    const authTokenConfig = buildVoiceAuthTokenConfig(config);

    const ai = new GoogleGenAI({ apiKey });
    const token = await ai.authTokens.create({ config: authTokenConfig });

    if (!token || !token.name) {
      throw new Error("Failed to generate ephemeral token from Google GenAI");
    }
    return NextResponse.json({ token: token.name });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ephemeral token";
    console.error("Error creating ephemeral token:", message);
    const isDev = process.env.NODE_ENV !== "production";
    const clientMessage = isDev
      ? `Token generation failed: ${message}`
      : "Failed to generate ephemeral session token. Please try again later.";
    return NextResponse.json({ error: clientMessage }, { status: 500 });
  }
}
