import { requireMobileAuth } from "@/lib/api/v1/guard";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import { cancelChatTurn } from "@/lib/actions/chat-turn";
import { isTurnId } from "@/lib/chat-turn";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `DELETE /api/v1/chats/:id/turns/:turnId` — discard a turn that never got an
 * answer.
 *
 * Stopping a stream and discarding a turn interrupted by a relaunch both land
 * here. The action only deletes the pending user message and only while no
 * answer exists, so a stop that races with the server finishing cannot erase a
 * paid answer.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; turnId: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id, turnId } = await params;
  if (!isTurnId(turnId)) {
    return notFoundError("Chat session not found.");
  }

  const owned = await verifyDocOwnership(COLLECTIONS.CHAT_SESSIONS, id, gate.userId);
  if (!owned) return notFoundError("Chat session not found.");

  return ok(await cancelChatTurn(id, gate.userId, turnId));
}