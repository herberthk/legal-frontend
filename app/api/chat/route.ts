import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { BASE_SYSTEM_INSTRUCTION } from "@/constants";
import {
  checkUserCanSend,
  getAuthenticatedUserId,
  recordUsageAndDeduct,
  saveChatSession,
} from "@/lib";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    // Read session ID from the custom header set by prepareSendMessagesRequest
    const rawSessionId = req.headers.get("x-chat-id");
    const sessionId =
      rawSessionId && rawSessionId.length > 0 ? rawSessionId : null;
    // 1. Authenticate the user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const canSend = await checkUserCanSend(userId);
    if (!canSend.canSend) {
      return new Response(JSON.stringify({ error: canSend.reason }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Stream the AI response
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: BASE_SYSTEM_INSTRUCTION,
      messages: await convertToModelMessages(messages),
      temperature: 0.2,
      onFinish: async ({ text, usage }) => {
        // 3. Record usage after completion
        const totalTokens =
          (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
        try {
          if (sessionId !== null && totalTokens > 0) {
            await recordUsageAndDeduct({
              userId,
              type: "TEXT_RESPONSE",
              tokens: totalTokens,
              sessionId,
            });
          }
          // 4. Save assistant message to chat session
          if (sessionId !== null && text) {
            await saveChatSession({
              sessionId,
              text,
              tokenCount: usage?.outputTokens ?? 0,
            });
          }
        } catch (err) {
          console.error("Error saving assistant message:", err);
        }
      },
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
