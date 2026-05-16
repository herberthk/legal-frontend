import { google, GoogleLanguageModelOptions } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { LEGAL_ADVISER_SYSTEM_INSTRUCTION } from "@/constants";
import {
  getAuthenticatedUserId,
  recordUsageAndDeduct,
  saveChatMessage,
} from "@/lib";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

//force to use edge runtime
// export const runtime = "edge";

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
    console.log("is first message", isFirstMessage);

    const textPart = lastUserMessage.parts?.find(
      (p: { type: string }) => p.type === "text",
    ) as { type: "text"; text: string } | undefined;
    const textToSend = textPart?.text || "";
    const estimatedInputTokens = Math.ceil(textToSend.length / 4);

    // Extract attachment metadata from the last user message (if any).
    // With Firebase Storage the URL is an HTTPS URL — no base64 stripping needed.
    const filePart = lastUserMessage.parts?.find(
      (p: { type: string }) => p.type === "file",
    ) as
      | { type: "file"; mediaType: string; filename?: string; url: string }
      | undefined;

    // Limit context window to the last N messages
    const historyMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    console.log("messages", historyMessages.length);

    // Convert UI messages → model messages.
    // Firebase Storage URLs are plain HTTPS URLs so convertToModelMessages
    // handles them correctly — no manual base64 extraction required.
    const modelMessages = await convertToModelMessages(historyMessages);

    const result = streamText({
      model: google("gemini-3-flash-preview"),
      system: LEGAL_ADVISER_SYSTEM_INSTRUCTION,
      providerOptions: {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        } satisfies GoogleLanguageModelOptions,
      },
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
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
          if (sessionId !== null && text) {
            // Save user message — include attachment metadata with Firebase Storage URL
            await saveChatMessage(sessionId, {
              role: "user",
              text: textToSend,
              tokenCount: estimatedInputTokens,
              isFirstMessage: isFirstMessage === "true",
              ...(filePart && {
                attachment: {
                  name: filePart.filename || "document.pdf",
                  contentType: filePart.mediaType,
                  url: filePart.url, // Real Firebase Storage URL
                },
              }),
            });

            // Save assistant message
            await saveChatMessage(sessionId, {
              role: "assistant",
              text: text,
              tokenCount: usage?.outputTokens ?? 0,
              isFirstMessage: false,
            });
          }
        } catch (err) {
          console.error("Error saving chat message:", err);
        }
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
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
