import { requireMobileAuth } from "@/lib/api/v1/guard";
import { checkUserCanSend } from "@/lib/actions/usage";
import { ok } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/billing/can-send` — cheap pre-flight the client can call before
 * starting an AI action to decide whether to prompt a top-up. Returns only
 * `{ canSend, reason }` — the underlying `user` doc is intentionally omitted to
 * avoid leaking un-normalised Firestore timestamps (`GET /api/v1/me` is the
 * canonical profile endpoint).
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { canSend, reason } = await checkUserCanSend(gate.userId);
  return ok({ canSend, reason: reason ?? null });
}
