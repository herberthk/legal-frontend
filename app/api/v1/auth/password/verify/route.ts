import { z } from "zod";
import { verifyOtp } from "@/lib/actions/email";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/password/verify` — verifies the reset OTP and marks it
 * `verified` server-side. This MUST run before `password/reset`, which refuses
 * to change the password unless the OTP doc is already verified (mirrors the web
 * reset flow). Pre-auth; App Check not enforced.
 * Returns `{ data: { success, message } }`.
 */
const schema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(10),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await verifyOtp(parsed.data.email, parsed.data.otp);
  return ok(result);
}
