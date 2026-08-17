import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { removeFCMToken } from "@/lib/actions/notifications";
import { verifyDocOwnership } from "@/lib/api/v1/ownership";
import { COLLECTIONS } from "@/constants";
import { ok, badRequest, notFoundError } from "@/lib/api/v1/response";

/**
 * `DELETE /api/v1/notifications/device` — unregisters an FCM token, e.g. on
 * logout. `removeFCMToken` carries no owner check, so we first confirm the token
 * doc belongs to the caller (`fcmTokens/{token}.userId`) and 404 otherwise — a
 * caller must not be able to delete another device's registration by guessing
 * its token. Token is read from the JSON body.
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

  const owned = await verifyDocOwnership(
    COLLECTIONS.FCM_TOKENS,
    parsed.data.token,
    gate.userId,
  );
  if (!owned) return notFoundError("Device token not found.");

  const result = await removeFCMToken(parsed.data.token);
  return ok(result);
}
