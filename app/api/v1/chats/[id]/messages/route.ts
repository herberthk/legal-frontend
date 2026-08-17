import { requireMobileAuth } from "@/lib/api/v1/guard";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import { getChatMessages } from "@/lib/actions/chat";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/chats/:id/messages` — paginated messages for a session (oldest
 * page fetched with `limit`; older pages via `cursorId` + `cursorCreatedAt`).
 *
 * `getChatMessages` reads a subcollection by session id with no owner check, so
 * the route verifies the parent session belongs to the caller first (IDOR guard)
 * and returns 404 otherwise.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(COLLECTIONS.CHAT_SESSIONS, id, gate.userId);
  if (!owned) return notFoundError("Chat session not found.");

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 10;

  const cursorId = url.searchParams.get("cursorId");
  const cursorCreatedAt = url.searchParams.get("cursorCreatedAt");
  const cursor =
    cursorId && cursorCreatedAt
      ? { id: cursorId, createdAt: cursorCreatedAt }
      : undefined;

  const result = await getChatMessages(id, limit, cursor);
  return ok(result);
}
