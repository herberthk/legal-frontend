import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getChatSessions, createChatSession } from "@/lib/actions/chat";
import { ok, badRequest } from "@/lib/api/v1/response";

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
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 20;

  const result = await getChatSessions(gate.userId, limit);
  return ok(result);
}

const createSchema = z.object({ title: z.string().min(1).max(200) });

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
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await createChatSession(gate.userId, parsed.data.title);
  return ok(result);
}
