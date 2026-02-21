import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { BASE_SYSTEM_INSTRUCTION } from "@/constants";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: BASE_SYSTEM_INSTRUCTION,
      messages: await convertToModelMessages(messages),
      temperature: 0.2,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred during chat generation." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
