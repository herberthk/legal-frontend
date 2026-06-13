import { google, GoogleLanguageModelOptions } from "@ai-sdk/google";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import {
  getAuthenticatedUserId,
  recordUsageAndDeduct,
  saveChatMessage,
  checkUserCanSend,
} from "@/lib";
import {
  LEGAL_ADVISER_SYSTEM_INSTRUCTION,
  CHARS_PER_TOKEN,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";

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
    let estimatedInputTokens = Math.ceil(textToSend.length / CHARS_PER_TOKEN);

    // Extract attachment metadata from the last user message (if any).
    // With Firebase Storage the URL is an HTTPS URL — no base64 stripping needed.
    const filePart = lastUserMessage.parts?.find(
      (p: { type: string }) => p.type === "file",
    ) as
      | { type: "file"; mediaType: string; filename?: string; url: string }
      | undefined;

    if (filePart) {
      if (filePart.mediaType === "application/pdf") {
        try {
          const response = await fetch(filePart.url);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const pdfParseModule = await import("pdf-parse");
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const parsed = await pdfParse(buffer);
          estimatedInputTokens += Math.ceil(
            parsed.text.length / CHARS_PER_TOKEN,
          );
        } catch (e) {
          console.error("Failed to parse PDF for token estimation in chat:", e);
          estimatedInputTokens += 2000; // fallback
        }
      } else if (filePart.mediaType.startsWith("image/")) {
        estimatedInputTokens += 258;
      }
    }

    const estimatedOutputTokens = 1000; // Typical chat response
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    const { canSend, reason, user } = await checkUserCanSend(userId);
    if (!canSend) {
      return new Response(JSON.stringify({ error: reason }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    const freeTokens =
      (user?.freeTextTokens ?? 0) + (user?.welcomeTextTokens ?? 0);
    const balanceDerivedTokens = Math.floor(
      ((user?.balance ?? 0) / COST_PER_THOUSAND_TOKENS_IN_CENTS) * 1000,
    );
    const totalAvailableTokens = freeTokens + balanceDerivedTokens;

    if (estimatedTotalTokens > totalAvailableTokens) {
      return new Response(
        JSON.stringify({
          error: `Insufficient tokens. This message requires ~${estimatedTotalTokens.toLocaleString()} tokens but you only have ~${totalAvailableTokens.toLocaleString()} available. Please add funds.`,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

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
