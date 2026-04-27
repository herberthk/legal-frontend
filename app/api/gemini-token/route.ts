import { getCurrentUser } from "@/lib/actions/auth";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

//force to use edge runtime
// export const runtime = "edge";
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error(
        "Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable",
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Set token to expire in 60 minutes, allowing 5 minutes to establish a new session
    const expireTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 5 * 60 * 1000,
    ).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    if (!token || !token.name) {
      throw new Error("Failed to generate ephemeral token");
    }

    return NextResponse.json({ token: token.name });
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    return NextResponse.json(
      { error: "Failed to create ephemeral token" },
      { status: 500 },
    );
  }
}
