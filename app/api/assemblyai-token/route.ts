// app/api/assemblyai-token/route.js
import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export async function GET() {
  const token = await client.realtime.createTemporaryToken({ expires_in: 480 });
  return Response.json({ token });
}
