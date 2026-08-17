import { z } from "zod";
import { initiateSignup } from "@/lib/actions/auth";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/signup/initiate` — Bearer twin of the web signup step 1.
 *
 * Pre-auth (no user yet), so App Check is NOT enforced here — `initiateSignup`
 * carries its own IP + email rate limiting (the same gate the web relies on).
 * Returns `{ data: { success, message } }`; check `success` (a taken email or a
 * rate-limit hit comes back as `success:false`, not an HTTP error). See
 * `docs/mobile/skills/authentication.md`.
 */
const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
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

  const result = await initiateSignup(parsed.data);
  return ok(result);
}
