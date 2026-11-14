import { GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  streamText,
  toUIMessageStream,
  UIMessage,
} from "ai";

import { recordUsageAndDeduct, checkUserCanSend } from "@/lib/actions/usage";
import { saveChatMessage } from "@/lib/actions/chat";
import { beginChatTurn, completeChatTurn } from "@/lib/actions/chat-turn";
import {
  checkAttachmentUrl,
  isAllowedFileUrl,
} from "@/lib/api/v1/attachment-url";
import { isTurnId } from "@/lib/chat-turn";
import { verifyChatSessionOwner } from "@/lib/api/v1/ownership";
import {
  LEGAL_ADVISER_SYSTEM_INSTRUCTION,
  CHARS_PER_TOKEN,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";
import { vertex } from "@/lib/actions/vertex";

/**
 * Shared core of the streaming chat endpoint.
 *
 * The web route (`app/api/chat/route.ts`) and the mobile route
 * (`app/api/v1/chat/route.ts`) are identical from this point on — they differ
 * ONLY in how `userId` is resolved (session cookie vs. Bearer ID token) and how
 * App Check is checked, both handled by the caller. Everything billing-critical
 * (token estimation, DOCX extraction, the `streamText` call, and the
 * `onEnd` deduction) lives here so it can never drift between the two surfaces.
 *
 * ── Two persistence paths ────────────────────────────────────────────────────
 * A request **without** `x-turn-id` is the web client and keeps the original
 * behaviour exactly: persist and bill once, in `onEnd`. A request **with** a
 * `x-turn-id` is the mobile client and goes through the turn outbox: the user
 * message is written before generation, the answer replaces `onEnd`, and a
 * repeated request replays a stored answer instead of paying for it again.
 *
 * Streaming is cancellable end to end: `req.signal` reaches `streamText`, so a
 * client Stop aborts the model rather than running the turn to completion.
 */

import { extractDocumentText } from "@/lib/document-extractor";
import {
  sanitizeChatContent,
  sanitizeFilename,
  sanitizeUntrustedDocumentText,
  wrapDocumentForModel,
} from "@/lib/security/sanitizer";

const MAX_HISTORY_MESSAGES = 6;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number): never {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  throw error;
}

function readTurnId(req: Request): string | null {
  const raw = req.headers.get("x-turn-id");
  return raw && isTurnId(raw) ? raw : null;
}

function originalFileOf(message: UIMessage | undefined) {
  return message?.parts?.find((part) => part.type === "file") as
    | { type: "file"; mediaType: string; filename?: string; url: string }
    | undefined;
}

function originalTextOf(message: UIMessage | undefined): string {
  const part = message?.parts?.find((entry) => entry.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  return part?.text || "";
}

async function fetchAttachment(rawUrl: string): Promise<Buffer> {
  const url = new URL(rawUrl);
  // The caller of this function has already validated the host and path; keep
  // the checks here so the helper stays safe if it is reused.
  if (!isAllowedFileUrl(url)) {
    throw new Error("Attachment URL is not allowed.");
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Attachment fetch failed: ${response.status}`);

  // Guard against unexpectedly large downloads (e.g. a 500 MB file that exhausts server RAM).
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large (${contentLength} bytes). Maximum allowed is 10 MB.`);
  }

  if (!response.body) {
    throw new Error("Attachment response body is empty");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ATTACHMENT_BYTES) {
        await reader.cancel();
        throw new Error(`Attachment too large (${totalBytes} bytes). Maximum allowed is 10 MB.`);
      }
      chunks.push(value);
    }
  }

  if (totalBytes === 0) {
    throw new Error("Attachment response body is empty (0 bytes)");
  }

  return Buffer.concat(chunks);
}

export async function handleChatRequest(
  req: Request,
  userId: string,
): Promise<Response> {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError("No messages provided.", 400);
    }
    // Read session ID from the custom header set by prepareSendMessagesRequest
    const rawSessionId = req.headers.get("x-chat-id");
    const sessionId =
      rawSessionId && rawSessionId.length > 0 ? rawSessionId : null;

    if (sessionId === null) {
      return jsonError("Missing x-chat-id header.", 400);
    }

    // Verify the chat session belongs to this user before streaming or persisting
    const isOwner = await verifyChatSessionOwner(sessionId, userId);
    if (!isOwner) {
      return jsonError("Chat session not found or access denied.", 403);
    }

    const isFirstMessage = req.headers.get("x-first-message");
    const turnId = readTurnId(req);
    const lastUserMessage = messages[messages.length - 1];

    // Preserve the original file metadata before we mutate parts for Gemini
    const originalFilePart = originalFileOf(lastUserMessage);
    const originalTextToSend = originalTextOf(lastUserMessage);

    /*
     * Validate every attachment before the pending row is written. A rejected
     * request must not leave an unreviewed URL in Firestore, and a history file
     * is re-fetched from the same prefix on every turn.
     */
    for (const message of messages) {
      for (const part of message.parts ?? []) {
        if (part.type !== "file" || !part.url) continue;
        const check = checkAttachmentUrl(part.url, userId);
        if (!check.ok) return jsonError(check.message, check.status);
      }
    }

    const { canSend, reason, user } = await checkUserCanSend(userId);

    /*
     * The outbox is resolved before the credit gate: a turn whose answer is
     * already stored is a replay, and a replay must still work for an account
     * that has since run out of credit. A new generation is always gated.
     *
     * The pending user document is written here, before any token estimation, so
     * a first question survives an app kill even if the estimate fails.
     */
    const began = turnId
      ? await beginChatTurn(
          sessionId,
          userId,
          {
            turnId,
            text: originalTextToSend,
            tokenCount: 0,
            ...(originalFilePart && {
              attachment: {
                name: originalFilePart.filename || "document",
                contentType: originalFilePart.mediaType,
                url: originalFilePart.url,
              },
            }),
            isFirstMessage: isFirstMessage === "true",
          },
          // A first turn was written together with its session, so a missing row
          // is a discard. A follow-up has no earlier write and must create one.
          { createIfMissing: isFirstMessage !== "true" },
        )
      : null;

    if (began) {
      if (began.status === "denied") {
        return jsonError("Chat session not found or access denied.", 403);
      }
      if (began.status === "cancelled") {
        // The reader discarded this turn; drop it locally and charge nothing.
        return jsonError("This message was discarded.", 410);
      }
      if (began.status === "replay" && turnId) {
        return replayTurn(turnId, began.replay ?? [], {
          userId,
          sessionId,
          tokens: began.replayTokens ?? 0,
        });
      }
    }

    if (!canSend) {
      // A pending turn keeps its row: the first question survives the trip to
      // the deposit screen and can be continued afterwards.
      return jsonError(reason ?? "Insufficient credit.", 402);
    }

    // Limit context window to the last N messages
    const historyMessages = messages.slice(-MAX_HISTORY_MESSAGES);

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
          // XSS defense: Sanitize text parts in conversation history with DOMPurify
          part.text = sanitizeChatContent(part.text || "");

          if (
            part.text &&
            (part.text.includes("--- Document:") ||
              part.text.includes("<untrusted_document_content"))
          ) {
            hasDocument = true;
          }
          if (msg === lastUserMessage) {
            estimatedInputTokens += Math.ceil(
              (part.text || "").length / CHARS_PER_TOKEN,
            );
          }
        } else if (part.type === "file") {
          hasDocument = true;

          // Every file part is validated, not only the last one: a history row
          // could otherwise point the provider at another user's object.
          const attachment = checkAttachmentUrl(part.url, userId);
          if (!attachment.ok) fail(attachment.message, attachment.status);

          // Sanitize filename against XSS, HTML tags, path traversal, and injection delimiters
          const safeFilename = sanitizeFilename(part.filename || "document");
          part.filename = safeFilename;

          // If it's a PDF or Image, Gemini supports it natively inline, but we need to estimate tokens for the NEW file
          if (msg === lastUserMessage) {
            if (
              part.mediaType === "application/pdf" ||
              part.filename?.toLowerCase().endsWith(".pdf")
            ) {
              partProcessingPromises.push(
                (async () => {
                  try {
                    const buffer = await fetchAttachment(part.url);
                    const extracted = await extractDocumentText(buffer, "pdf");
                    estimatedInputTokens += extracted.estimatedTokens;
                  } catch (e) {
                    console.error(
                      "Failed to parse PDF for token estimation in chat:",
                      e,
                    );
                    estimatedInputTokens += 2000;
                  }
                })(),
              );
            } else if (part.mediaType?.startsWith("image/")) {
              estimatedInputTokens += 258;
            }
          }

          // If it's a DOCX, we MUST extract it to text for Gemini (whether it's the last message or history)
          if (
            part.mediaType ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            part.filename?.toLowerCase().endsWith(".docx") ||
            part.url?.toLowerCase().includes(".docx")
          ) {
            partProcessingPromises.push(
              (async () => {
                try {
                  const buffer = await fetchAttachment(part.url);
                  const extracted = await extractDocumentText(buffer, "docx");

                  // Defend against prompt injection and XSS in extracted document text using DOMPurify and heuristic defenses
                  const { sanitizedText, hasInjectionAttempt, detectedThreats } =
                    sanitizeUntrustedDocumentText(extracted.text, safeFilename);

                  if (hasInjectionAttempt) {
                    console.warn(
                      `[SECURITY WARNING] Potential prompt injection detected in file "${safeFilename}":`,
                      detectedThreats,
                    );
                  }

                  if (msg === lastUserMessage) {
                    estimatedInputTokens += Math.ceil(
                      sanitizedText.length / CHARS_PER_TOKEN,
                    );
                  }

                  // Replace the file part with a securely delimited, injection-resistant prompt container
                  msg.parts[i] = {
                    type: "text",
                    text: `\n\n${wrapDocumentForModel(sanitizedText, safeFilename)}\n\n`,
                  };
                } catch (e) {
                  console.error("Failed to parse DOCX in chat:", e);
                  if (msg === lastUserMessage) {
                    estimatedInputTokens += 2000;
                  }
                  msg.parts[i] = {
                    type: "text",
                    text: `\n\n[Failed to read document: ${safeFilename}]\n\n`,
                  };
                }
              })(),
            );
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
      // A persisted-but-unanswered turn is deliberately left alone so the
      // question can be continued after a top-up.
      return jsonError(
        `Insufficient tokens. This message requires ~${estimatedTotalTokens.toLocaleString()} tokens but you only have ~${totalAvailableTokens.toLocaleString()} available. Please add funds.`,
        402,
      );
    }

    // We already sliced historyMessages and processed them above.

    // Convert UI messages → model messages.
    // Firebase Storage URLs are plain HTTPS URLs so convertToModelMessages
    // handles them correctly — no manual base64 extraction required.
    const modelMessages = await convertToModelMessages(historyMessages);

    if (turnId && began?.status === "started") {
      // The estimate is final: store the input token count on the pending row so
      // history shows the same cost whether the turn finished or is continued.
      const pending = await beginChatTurn(
        sessionId,
        userId,
        {
          turnId,
          text: originalTextToSend,
          tokenCount: estimatedInputTokens,
          ...(originalFilePart && {
            attachment: {
              name: originalFilePart.filename || "document",
              contentType: originalFilePart.mediaType,
              url: originalFilePart.url,
            },
          }),
          isFirstMessage: isFirstMessage === "true",
        },
        // Update-only: a discard that landed during estimation must win.
        { createIfMissing: false },
      );
      if (pending.status !== "started") {
        // Turned into a replay or a discard while the document was being read;
        // either way the request that just did the estimation is stale.
        if (pending.status === "replay") {
          return replayTurn(turnId, pending.replay ?? [], {
            userId,
            sessionId,
            tokens: pending.replayTokens ?? 0,
          });
        }
        return jsonError("This message was discarded.", 410);
      }
    }

    const result = streamText({
      // model: vertex("gemini-3-flash-preview"),
      model: vertex("gemini-3.7-flash"),
      temperature: 0,
      instructions: LEGAL_ADVISER_SYSTEM_INSTRUCTION({
        username: user?.name?.split(" ")[0] || "User",
      }),
      providerOptions: {
        vertex: {
          thinkingConfig: {
            includeThoughts: true,
          },
        } satisfies GoogleLanguageModelOptions,
      },
      // Reshape Gemini's bursty, multi-sentence chunks into an even word-by-word
      // cadence so the client renders a steady stream instead of large jumps.
      // Smooths BOTH the answer and the reasoning/"thinking" stream. delayInMs:10
      // drains at ~100 words/sec, which keeps even very long answers under the
      // maxDuration=30s ceiling (see note above the export).
      experimental_transform: smoothStream({ chunking: "word", delayInMs: 20 }),
      messages: modelMessages,
      // A client Stop aborts the request; ending generation is what makes the
      // discard free instead of merely invisible.
      abortSignal: req.signal,
      ...(turnId
        ? {}
        : {
            onEnd: async ({ text, usage }: { text: string; usage?: { outputTokens?: number } }) => {
              const totalTokens =
                (estimatedInputTokens ?? 0) + (usage?.outputTokens ?? 0);

              if (!sessionId) return;

              try {
                const dbPromises = [];

                if (totalTokens > 0) {
                  dbPromises.push(
                    recordUsageAndDeduct({
                      userId,
                      type: "TEXT_RESPONSE",
                      tokens: totalTokens,
                      sessionId,
                    }),
                  );
                }

                if (text || originalTextToSend || originalFilePart) {
                  dbPromises.push(
                    (async () => {
                      // We await these sequentially to guarantee the user message gets an older or equal timestamp
                      // than the assistant message and they appear in the correct order in Firestore.
                      await saveChatMessage(sessionId, {
                        role: "user",
                        // Sanitize user text with DOMPurify before saving to Firestore to prevent Stored XSS
                        text: sanitizeChatContent(originalTextToSend),
                        tokenCount: estimatedInputTokens,
                        isFirstMessage: isFirstMessage === "true",
                        ...(originalFilePart && {
                          attachment: {
                            name: sanitizeFilename(originalFilePart.filename || "document.pdf"),
                            contentType: originalFilePart.mediaType,
                            url: originalFilePart.url,
                          },
                        }),
                      });

                      if (text) {
                        await saveChatMessage(sessionId, {
                          role: "assistant",
                          // Sanitize assistant text with DOMPurify before saving to Firestore to prevent Stored XSS
                          text: sanitizeChatContent(text),
                          tokenCount: usage?.outputTokens ?? 0,
                          isFirstMessage: false,
                        });
                      }
                    })(),
                  );
                }

                // Awaiting here ensures all database writes and deductions are committed
                // BEFORE the stream closes, preventing serverless freeze/loss and client race conditions.
                await Promise.all(dbPromises);
              } catch (err) {
                console.error(
                  `[onEnd] Failed to persist chat or record usage — userId=${userId} sessionId=${sessionId} totalTokens=${totalTokens}:`,
                  err,
                );
              }
            },
          }),
    });

    if (!turnId) {
      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream: result.stream, sendReasoning: true }),
      });
    }

    /*
     * The outbox path persists the answer inside the stream, after the last text
     * delta and before the stream closes. The client is only told the turn is
     * finished once the write has committed, so a lost response can be replayed
     * instead of silently losing a paid answer.
     */
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const merged = toUIMessageStream({
          stream: result.stream,
          sendReasoning: true,
          onFinish: async ({ responseMessage, isAborted }) => {
            // onFinish is awaited before the transformed stream closes, which is
            // what keeps a finished answer from being lost when the response
            // never reaches the device. An aborted turn persists nothing.
            if (isAborted || req.signal.aborted) return;
            const answer = (responseMessage?.parts ?? [])
              .filter((part) => part.type === "text")
              .map((part) => (part as { text: string }).text)
              .join("");
            try {
              const usage = await result.usage;
              const outputTokens = usage?.outputTokens ?? 0;
              const totalTokens = estimatedInputTokens + outputTokens;

              const completed = await completeChatTurn(sessionId, userId, {
                turnId,
                answer,
                answerTokens: outputTokens,
                userTokens: estimatedInputTokens,
                ...(isFirstMessage === "true" && originalTextToSend
                  ? { title: originalTextToSend.slice(0, 100) }
                  : {}),
              });

              if (!completed.success) {
                // The turn was discarded while it streamed; persist nothing.
                console.warn(
                  `[chat] turn ${turnId} was discarded before it could be saved`,
                );
                return;
              }

              if (totalTokens > 0) {
                await recordUsageAndDeduct({
                  userId,
                  type: "TEXT_RESPONSE",
                  tokens: totalTokens,
                  sessionId,
                  idempotencyKey: turnId,
                });
              }
            } catch (error) {
              // The stream still completes for the reader; the next replay
              // finishes the write and bills the turn exactly once.
              console.error(
                `[chat] failed to persist turn ${turnId}; it will be retried on the next request:`,
                error,
              );
            }
          },
        });

        writer.merge(merged);
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 402 || status === 404) {
      return jsonError((error as Error).message, status);
    }
    console.error("Error in /api/chat:", error);
    return jsonError("An error occurred during chat generation.", 500);
  }
}

/**
 * Replays a turn that already has a stored answer.
 *
 * The stored answer is streamed as an ordinary UI message stream, so the client
 * renders it exactly like a fresh answer without the model being called. Billing
 * is attempted again with the turn id as the idempotency key: a process that
 * persisted the answer but died before recording usage leaves a completed but
 * unbilled turn, and the next replay settles it exactly once.
 */
async function replayTurn(
  turnId: string,
  replay: { role: "user" | "assistant"; text: string }[],
  billing: { userId: string; sessionId: string; tokens: number },
): Promise<Response> {
  if (billing.tokens > 0) {
    const settled = await recordUsageAndDeduct({
      userId: billing.userId,
      type: "TEXT_RESPONSE",
      tokens: billing.tokens,
      sessionId: billing.sessionId,
      idempotencyKey: turnId,
    });
    if (!settled.success) {
      // The stored answer is still the right response; the next replay retries.
      console.error(`[chat] could not settle replayed turn ${turnId}`);
    }
  }

  const answer = replay.find((entry) => entry.role === "assistant");
  const text = answer?.text ?? "";
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start", messageId: `${turnId}-a` });
      if (text) {
        writer.write({ type: "text-start", id: `${turnId}-text` });
        writer.write({ type: "text-delta", id: `${turnId}-text`, delta: text });
        writer.write({ type: "text-end", id: `${turnId}-text` });
      }
      writer.write({ type: "finish", messageMetadata: undefined });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
