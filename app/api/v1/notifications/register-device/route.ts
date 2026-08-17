import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { saveFCMToken } from "@/lib/actions/notifications";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/notifications/register-device` — upserts the device's FCM
 * registration token so push can reach it. The key new mobile need: RN obtains
 * the token from `@react-native-firebase/messaging` and posts it here on login /
 * token refresh. The token doc is keyed by the token and stamped with the
 * caller's uid (from the Bearer token, never the body).
 */
const schema = z.object({ token: z.string().min(1).max(4096) });

export async function POST(req: Request) {
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

  const result = await saveFCMToken(gate.userId, parsed.data.token);
  return ok(result);
}
