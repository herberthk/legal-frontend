import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getLatestUnreadNotifications } from "@/lib/actions/notifications";
import { ok, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/notifications/unread` — the five most recent unread
 * notifications, for a bell/badge preview. Static segment, so it never collides
 * with `notifications/:id`.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const result = await getLatestUnreadNotifications(gate.userId);
  if (!result.success) return internalError("Failed to retrieve notifications.");
  return ok(result);
}
