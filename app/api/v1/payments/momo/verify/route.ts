import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { verifyPhoneNumber } from "@/lib/actions/payment";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/payments/momo/verify` — looks up the registered name on a mobile
 * money number so the client can show a confirmation step before charging.
 * Returns `{ data: { success, data?: { fullName, msisdn } } }`; a lookup that
 * fails comes back as `success:false` (not an HTTP error).
 */
const schema = z.object({ msisdn: z.string().min(6).max(20) });

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

  const result = await verifyPhoneNumber(parsed.data.msisdn);
  return ok(result);
}
