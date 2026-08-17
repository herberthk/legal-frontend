import { requireMobileAuth } from "@/lib/api/v1/guard";
import { markAllAsRead } from "@/lib/actions/notifications";
import { ok, internalError } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/notifications/read-all` — marks every unread notification for
 * the caller as read. Scoped to `userId` inside the action, so no per-doc
 * ownership check is needed. Static segment (no clash with `notifications/:id`).
 */
export async function POST(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const result = await markAllAsRead(gate.userId);
  if (!result.success) return internalError(result.error || "Failed to mark notifications as read.");
  return ok(result);
}
