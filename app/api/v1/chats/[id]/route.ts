import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import {
  updateChatSessionTitle,
  deleteChatSession,
} from "@/lib/actions/chat";
import { ok, badRequest, notFoundError } from "@/lib/api/v1/response";

/**
 * `PATCH /api/v1/chats/:id` — rename a session. `DELETE /api/v1/chats/:id` —
 * delete it (and its messages + attachments, handled by the action).
 *
 * `updateChatSessionTitle` / `deleteChatSession` carry NO owner check of their
 * own (safe on the cookie-authed web, unsafe under the Admin SDK), so both
 * routes call `verifyDocOwnership` first and treat a non-owned id as 404.
 */
const patchSchema = z.object({ title: z.string().min(1).max(200) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(COLLECTIONS.CHAT_SESSIONS, id, gate.userId);
  if (!owned) return notFoundError("Chat session not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await updateChatSessionTitle(id, parsed.data.title);
  return ok(result);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(COLLECTIONS.CHAT_SESSIONS, id, gate.userId);
  if (!owned) return notFoundError("Chat session not found.");

  const result = await deleteChatSession(id);
  return ok(result);
}
