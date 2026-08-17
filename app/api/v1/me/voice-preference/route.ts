import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { updateUserVoicePreference } from "@/lib/actions/user";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `PATCH /api/v1/me/voice-preference` — sets the user's preferred Gemini Live
 * voice. `preferedVoiceId` is validated as a non-empty string here (the `Voice`
 * union is enforced by the client picker); the action stores it verbatim.
 */
const schema = z.object({
  preferedVoiceId: z.string().min(1).max(64),
  preferedVoiceName: z.string().min(1).max(120),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await updateUserVoicePreference(
    parsed.data as PreferedVoice,
    gate.userId,
  );
  return ok(result);
}
