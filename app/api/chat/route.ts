import { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, UIMessage } from "ai";

import {
  getAuthenticatedUserId,
  recordUsageAndDeduct,
  saveChatMessage,
  checkUserCanSend
} from "@/lib";
import {
  LEGAL_ADVISER_SYSTEM_INSTRUCTION,
  CHARS_PER_TOKEN,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";
import { vertex } from "@/lib/actions/vertex";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Cache dynamic imports so they are only loaded once per cold start
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPdfParse: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedMammoth: any = null;

const MAX_HISTORY_MESSAGES = 6;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Read session ID from the custom header set by prepareSendMessagesRequest
    const rawSessionId = req.headers.get("x-chat-id");
    const sessionId =
      rawSessionId && rawSessionId.length > 0 ? rawSessionId : null;
    const isFirstMessage = req.headers.get("x-first-message");

    // 1. Authenticate the user and check permissions EARLY
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const { canSend, reason, user } = await checkUserCanSend(userId);
    if (!canSend) {
      return new Response(JSON.stringify({ error: reason }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const lastUserMessage = messages[messages.length - 1];
    console.log("is first message", isFirstMessage);
    
    // Preserve the original file metadata before we mutate parts for Gemini
    const originalFilePart = lastUserMessage.parts?.find(
      (p) => p.type === "file"
    ) as { type: "file"; mediaType: string; filename?: string; url: string } | undefined;
    const originalTextPart = lastUserMessage.parts?.find(
      (p) => p.type === "text"
    ) as { type: "text"; text: string } | undefined;
    const originalTextToSend = originalTextPart?.text || "";

    // Limit context window to the last N messages
    const historyMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    console.log("messages", historyMessages.length);

    let estimatedInputTokens = 0;
    let hasDocument = false;
    const partProcessingPromises: Promise<void>[] = [];

    // Process historyMessages to replace .docx file parts with extracted text
    // Gemini API does not natively support inline .docx, so we must extract it.
    for (const msg of historyMessages) {
      if (!msg.parts) continue;
      
      for (let i = 0; i < msg.parts.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const part = msg.parts[i] as any;
        
        if (part.type === "text") {
          if (part.text && part.text.includes("--- Document:")) {
            hasDocument = true;
          }
          if (msg === lastUserMessage) {
            estimatedInputTokens += Math.ceil((part.text || "").length / CHARS_PER_TOKEN);
          }
        } else if (part.type === "file") {
          hasDocument = true;
          // If it's a PDF or Image, Gemini supports it natively inline, but we need to estimate tokens for the NEW file
          if (msg === lastUserMessage) {
            if (part.mediaType === "application/pdf" || part.filename?.toLowerCase().endsWith(".pdf")) {
              partProcessingPromises.push((async () => {
                try {
                  const response = await fetch(part.url);
                  const arrayBuffer = await response.arrayBuffer();
                  const buffer = Buffer.from(arrayBuffer);
                  if (!cachedPdfParse) {
                    const pdfParseModule = await import("pdf-parse");
                    cachedPdfParse = pdfParseModule.default || pdfParseModule;
                  }
                  const parsed = await cachedPdfParse(buffer);
                  estimatedInputTokens += Math.ceil(parsed.text.length / CHARS_PER_TOKEN);
                } catch (e) {
                  console.error("Failed to parse PDF for token estimation in chat:", e);
                  estimatedInputTokens += 2000;
                }
              })());
            } else if (part.mediaType.startsWith("image/")) {
              estimatedInputTokens += 258;
            }
          }
          
          // If it's a DOCX, we MUST extract it to text for Gemini (whether it's the last message or history)
          if (part.mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || part.filename?.toLowerCase().endsWith(".docx") || part.url?.toLowerCase().includes(".docx")) {
            partProcessingPromises.push((async () => {
              try {
                const response = await fetch(part.url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                if (!cachedMammoth) {
                  cachedMammoth = await import("mammoth");
                }
                const result = await cachedMammoth.extractRawText({ buffer });
                const docxText = result.value;
                
                if (msg === lastUserMessage) {
                  estimatedInputTokens += Math.ceil(docxText.length / CHARS_PER_TOKEN);
                }
                
                // Replace the file part with a text part so Gemini doesn't reject the MIME type
                msg.parts[i] = { 
                  type: "text", 
                  text: `\n\n--- Document: ${part.filename || 'document.docx'} ---\n${docxText}\n--- End Document ---\n\n` 
                };
              } catch (e) {
                console.error("Failed to parse DOCX in chat:", e);
                if (msg === lastUserMessage) {
                  estimatedInputTokens += 2000;
                }
                msg.parts[i] = { type: "text", text: `\n\n[Failed to read document: ${part.filename}]\n\n` };
              }
            })());
          }
        }
      }
    }

    await Promise.all(partProcessingPromises);

    const estimatedOutputTokens = hasDocument ? 1000 : 150; // 1000 for document queries, 150 for simple chat
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

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

    // We already sliced historyMessages and processed them above.

    // Convert UI messages → model messages.
    // Firebase Storage URLs are plain HTTPS URLs so convertToModelMessages
    // handles them correctly — no manual base64 extraction required.
    const modelMessages = await convertToModelMessages(historyMessages);

    const result = streamText({
      // model: vertex("gemini-3-flash-preview"),
      model: vertex("gemini-3.6-flash"),
      temperature: 0,
      instructions: LEGAL_ADVISER_SYSTEM_INSTRUCTION({username:user?.name?.split(" ")[0] || "User"}),
      providerOptions: {
        vertex: {
          thinkingConfig: {
            includeThoughts: true,
          },
        } satisfies GoogleLanguageModelOptions,
      },
      messages: modelMessages,
      onEnd: async ({ text, usage }) => {
        const totalTokens =
          (estimatedInputTokens ?? 0) + (usage?.outputTokens ?? 0);
        
        // Execute database updates in background asynchronously so response stream closes cleanly
        (async () => {
          try {
            if (sessionId !== null) {
              const dbPromises = [];

              if (totalTokens > 0) {
                dbPromises.push(
                  recordUsageAndDeduct({
                    userId,
                    type: "TEXT_RESPONSE",
                    tokens: totalTokens,
                    sessionId,
                  })
                );
              }

              if (text) {
                dbPromises.push(
                  (async () => {
                  // We await these sequentially to guarantee the user message gets an older or equal timestamp
                  // than the assistant message and they appear in the correct order in Firestore.
                    await saveChatMessage(sessionId, {
                      role: "user",
                    // We use the original text and original file metadata preserved at the top of the route.
                      text: originalTextToSend,
                      tokenCount: estimatedInputTokens,
                      isFirstMessage: isFirstMessage === "true",
                      ...(originalFilePart && {
                        attachment: {
                          name: originalFilePart.filename || "document.pdf",
                          contentType: originalFilePart.mediaType,
                          url: originalFilePart.url,
                        },
                      }),
                    });

                    await saveChatMessage(sessionId, {
                      role: "assistant",
                      text: text,
                      tokenCount: usage?.outputTokens ?? 0,
                      isFirstMessage: false,
                    });
                  })()
                );
              }

              await Promise.all(dbPromises);
            }
          } catch (err) {
            console.error("Error saving chat message:", err);
          }
        })();
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream, sendReasoning: true }),
    });
    
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
