import { z } from "zod";
import { completeSignup } from "@/lib/actions/auth";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/signup/complete` — verifies the signup OTP, creates the
 * Firebase Auth user + Firestore profile, and returns a **custom token** the RN
 * client exchanges via `signInWithCustomToken` to obtain its first ID token.
 *
 * Pre-auth; App Check not enforced (bootstrap path). Returns
 * `{ data: { success, message, uid, customToken } }`.
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

  const result = await completeSignup(parsed.data.email, parsed.data.otp);
  return ok(result);
}
