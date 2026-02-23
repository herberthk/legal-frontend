// app/api/assemblyai-token/route.ts
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export async function GET() {
  try {
    // New v3 method: client.streaming (not client.realtime)
    // expires_in_seconds (not expires_in), max 600 seconds
    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: 480,
    });
    return Response.json({ token });
  } catch (err) {
    console.error("Error generating token:", err);
    return Response.json(
      { error: "Failed to generate token" },
      { status: 500 },
    );
  }
}
