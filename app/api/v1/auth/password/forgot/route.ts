import { z } from "zod";
import { forgotPassword } from "@/lib/actions/auth";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/password/forgot` — sends a password-reset OTP. Pre-auth;
 * App Check not enforced (`forgotPassword` is IP + email rate limited). The
 * reset flow is three calls: forgot → `password/verify` → `password/reset`.
 * Returns `{ data: { success, message, code? } }`.
 */
const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await forgotPassword(parsed.data.email);
  if (result.success || result.code === "user-not-found") {
    return ok({
      success: true,
      message: "If an account exists with this email, a reset code has been sent.",
    });
  }
  return ok(result);
}
