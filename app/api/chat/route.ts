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

    // Extract attachment metadata from the last user message (if any)
    const filePart = lastUserMessage.parts?.find(
      (p: { type: string }) => p.type === "file",
    ) as
      | { type: "file"; mediaType: string; filename?: string; url: string }
      | undefined;

    const historyMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    console.log("messages", historyMessages.length);

    // --- Preprocess: strip data: URL file parts before conversion ---
    // convertToModelMessages tries to HTTP-fetch file URLs, which fails for
    // inline data: URLs. We extract them, convert to ModelMessages without
    // them, then re-inject the file data as inline base64 FileParts.
    const extractedFiles: Array<{
      msgIndex: number;
      data: Buffer;
      mediaType: string;
    }> = [];

    const cleanedMessages = historyMessages.map((msg, i) => {
      const hasDataUrl = msg.parts?.some(
        (p) =>
          p.type === "file" &&
          typeof (p as { url?: string }).url === "string" &&
          (p as { url: string }).url.startsWith("data:"),
      );
      if (!hasDataUrl) return msg;

      const filteredParts = msg.parts?.filter((p) => {
        if (p.type === "file") {
          const fileP = p as { url?: string; mediaType: string };
          if (fileP.url?.startsWith("data:")) {
            const base64 = fileP.url.split(",")[1];
            extractedFiles.push({
              msgIndex: i,
              data: Buffer.from(base64, "base64"),
              mediaType: fileP.mediaType,
            });
            return false; // Remove from parts
          }
        }
        return true;
      });

      return { ...msg, parts: filteredParts } as UIMessage;
    });

    const modelMessages = await convertToModelMessages(cleanedMessages);

    // Re-inject extracted file data into the last user model message
    if (extractedFiles.length > 0) {
      // Find the last user message in the model messages array
      const lastUserModelMsg = [...modelMessages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserModelMsg) {
        for (const extracted of extractedFiles) {
          if (typeof lastUserModelMsg.content === "string") {
            lastUserModelMsg.content = [
              { type: "text" as const, text: lastUserModelMsg.content },
              {
                type: "file" as const,
                data: extracted.data,
                mediaType: extracted.mediaType,
              },
            ];
          } else if (Array.isArray(lastUserModelMsg.content)) {
            lastUserModelMsg.content.push({
              type: "file" as const,
              data: extracted.data,
              mediaType: extracted.mediaType,
            });
          }
        }
      }
    }

    const result = streamText({
      model: google("gemini-3-flash-preview"),
      system: LEGAL_ADVISER_SYSTEM_INSTRUCTION,
      providerOptions: {
        google: {
          thinkingConfig: {
            // For Gemini 3 models, use thinkingLevel (e.g. 'minimal', 'low', 'medium', 'high')
            // thinkingLevel: "medium",
            includeThoughts: true,
          },
        } satisfies GoogleLanguageModelOptions,
      },
      messages: modelMessages,
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
            // Save user message (with attachment metadata if present)
            await saveChatMessage(sessionId, {
              role: "user",
              text: textToSend,
              tokenCount: estimatedInputTokens,
              isFirstMessage: isFirstMessage === "true",
              ...(filePart && {
                attachment: {
                  name: filePart.filename || "document.pdf",
                  type: filePart.mediaType,
                  url: "",
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
          console.error("Error saving assistant message:", err);
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
