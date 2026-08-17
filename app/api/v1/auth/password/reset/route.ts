import { z } from "zod";
import { resetPasswordWithOtp } from "@/lib/actions/auth";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/password/reset` — sets a new password. Requires the OTP to
 * have already been verified via `password/verify` (the action checks the
 * `verified` flag and rejects otherwise). Pre-auth; App Check not enforced.
 * Returns `{ data: { success, message } }`.
 */
const schema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6).max(128),
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

  const result = await resetPasswordWithOtp(
    parsed.data.email,
    parsed.data.newPassword,
  );
  return ok(result);
}
