import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { removeFCMTokenFor } from "@/services/fcm";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { getFCMTokenDocId } from "@/lib/fcm-utils";
import { COLLECTIONS } from "@/constants";
import { ok, badRequest, notFoundError, internalError } from "@/lib/api/v1/response";

/**
 * `DELETE /api/v1/notifications/device` — unregisters an FCM token, e.g. on
 * logout. We first confirm the token doc belongs to the caller
 * (`fcmTokens/{docId}.userId`) and 404 otherwise — a caller must not be able to
 * delete another device's registration by guessing its token. `removeFCMTokenFor`
 * additionally scopes its own deletes to the passed uid. Token is read from the
 * JSON body.
 *
 * Calls `removeFCMTokenFor` (in `services/fcm.ts`) rather than the
 * `removeFCMToken` server action: that action resolves identity from the web
 * `session` cookie, which a Bearer client never sends, so it would always fail
 * here.
 */
const schema = z.object({ token: z.string().min(1).max(4096) });

export async function DELETE(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const docId = getFCMTokenDocId(parsed.data.token);
  const owned = await verifyDocOwnership(
    COLLECTIONS.FCM_TOKENS,
    docId,
    gate.userId,
  );
  if (!owned) return notFoundError("Device token not found.");

  const result = await removeFCMTokenFor(gate.userId, parsed.data.token);
  if (!result.success) return internalError("Failed to unregister device token.");
  return ok({ success: true });
}
