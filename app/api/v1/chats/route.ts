import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { checkAttachmentUrl } from "@/lib/api/v1/attachment-url";
import { getChatSessions, createChatSession } from "@/lib/actions/chat";
import { createChatSessionWithTurn } from "@/lib/actions/chat-turn";
import { TURN_ID_PATTERN } from "@/lib/chat-turn";
import {
  ok,
  badRequest,
  internalError,
  notFoundError,
} from "@/lib/api/v1/response";

/**
 * `GET /api/v1/chats` — the caller's chat sessions (most recent first).
 * `POST /api/v1/chats` — creates an empty session and returns its `sessionId`,
 * which the client then sends as the `x-chat-id` header on `POST /api/v1/chat`
 * so messages are billed + persisted to that session.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 20;

  const result = await getChatSessions(gate.userId, limit);
  if (!result.success) return internalError("Failed to retrieve chat sessions.");
  return ok(result);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  turnId: z.string().regex(TURN_ID_PATTERN).optional(),
  text: z.string().max(20_000).optional(),
  attachment: z
    .object({
      name: z.string().min(1).max(255),
      contentType: z.string().min(1).max(128),
      url: z.string().url().startsWith("https://"),
    })
    .optional(),
});

/**
 * The first turn may be created together with the session so a question that is
 * interrupted before the first stream still exists on the server. `turnId` alone
 * keeps the old behaviour (an empty session) for a web-style caller.
 */
export async function POST(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid request body");

  const { turnId, text, attachment } = parsed.data;

  if (attachment) {
    const check = checkAttachmentUrl(attachment.url, gate.userId);
    if (!check.ok) {
      return check.status === 404
        ? notFoundError(check.message)
        : badRequest(check.message);
    }
  }

  const result =
    turnId && (text || attachment)
      ? await createChatSessionWithTurn(gate.userId, parsed.data.title, {
          turnId,
          text: text ?? "",
          tokenCount: 0,
          isFirstMessage: true,
          ...(attachment ? { attachment } : {}),
        })
      : await createChatSession(gate.userId, parsed.data.title);
  if (!result.success) return internalError("Failed to create chat session.");
  return ok(result);
}
