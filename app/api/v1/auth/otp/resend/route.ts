import { z } from "zod";
import { resendOtpAction } from "@/lib/actions/auth";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/otp/resend` — resends the OTP for either the signup or the
 * password-reset flow. Pre-auth; App Check not enforced (`resendOtpAction` is
 * rate limited). Returns `{ data: { success, message } }`.
 */
const schema = z.object({
  email: z.string().email(),
  type: z.enum(["signup", "reset"]),
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

  const result = await resendOtpAction(parsed.data.email, parsed.data.type);
  return ok(result);
}
