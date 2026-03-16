import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { BASE_SYSTEM_INSTRUCTION } from "@/constants";
import {
  getAuthenticatedUserId,
  recordUsageAndDeduct,
  saveChatMessage,
} from "@/lib";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
const MAX_HISTORY_MESSAGES = 6;
export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    // Read session ID from the custom header set by prepareSendMessagesRequest
    const rawSessionId = req.headers.get("x-chat-id");
    const sessionId =
      rawSessionId && rawSessionId.length > 0 ? rawSessionId : null;
    const isFirstMessage = req.headers.get("x-first-message");
    // 1. Authenticate the user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const lastUserMessage = messages[messages.length - 1];
    // console.log("lastUserMessage", lastUserMessage);
    // console.log("is first message", isFirstMessage);

    //@ts-ignore
    const textToSend = lastUserMessage.parts[0].text;
    const estimatedInputTokens = Math.ceil(textToSend.length / 4);
    const historyMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    // console.log("messages", historyMessages.length);
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: BASE_SYSTEM_INSTRUCTION,
      messages: await convertToModelMessages(historyMessages),
      temperature: 0.2,
      onFinish: async ({ text, usage }) => {
        // 3. Record usage after completion
        const totalTokens =
          (estimatedInputTokens ?? 0) + (usage?.outputTokens ?? 0);
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
            // Save user message
            // const attachmentToSend = lastUserMessage.attachments?.[0];
            await saveChatMessage(sessionId, {
              role: "user",
              text: textToSend,
              tokenCount: estimatedInputTokens,
              isFirstMessage: isFirstMessage === "true",
              // ...(attachmentToSend && {
              //   attachment: {
              //     name: attachmentToSend.name,
              //     type: attachmentToSend.type,
              //     url: "",
              //   },
              // }),
            });

            // Save assistant message
            await saveChatMessage(sessionId, {
              role: "assistant",
              text: text,
              tokenCount: usage?.outputTokens ?? 0,
              isFirstMessage: false,
            });
            // await saveChatSession({
            //   sessionId,
            //   text,
            //   tokenCount: usage?.outputTokens ?? 0,
            // });
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
