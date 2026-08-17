import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getUserFromRequest } from "@/lib/api/v1/auth";
import { updateUserProfile } from "@/lib/actions/user";
import { ok, badRequest, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/me` — the "who am I" + balance endpoint. Returns the full user
 * document with dates normalised to ISO strings (identical shape to the web's
 * `getCurrentUser()`). `PATCH /api/v1/me` updates the display name / avatar.
 * Both App-Check + Bearer gated via `requireMobileAuth`.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const user = await getUserFromRequest(req);
  if (!user) {
    return notFoundError(
      "Profile not found. Complete setup via POST /api/v1/auth/profile/sync.",
    );
  }
  return ok(user);
}

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    avatar: z.string().url().max(2048).optional(),
  })
  .refine((d) => d.name !== undefined || d.avatar !== undefined, {
    message: "Provide at least one of name or avatar",
  });

export async function PATCH(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid request body");
  }

  const result = await updateUserProfile(parsed.data, gate.userId);
  return ok(result);
}
