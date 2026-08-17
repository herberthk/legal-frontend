import { requireMobileAuth } from "@/lib/api/v1/guard";
import { markAsRead } from "@/lib/actions/notifications";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import { ok, notFoundError, internalError } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/notifications/:id/read` — marks one notification read.
 * `markAsRead` takes only an id and has no owner check, so we verify ownership
 * first (IDOR guard) and 404 on a foreign/unknown id.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const owned = await verifyDocOwnership(COLLECTIONS.NOTIFICATIONS, id, gate.userId);
  if (!owned) return notFoundError("Notification not found.");

  const result = await markAsRead(id);
  if (!result.success) return internalError(result.error || "Failed to mark notification as read.");
  return ok(result);
}
