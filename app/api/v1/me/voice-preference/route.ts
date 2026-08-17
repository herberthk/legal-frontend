import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { updateUserVoicePreference } from "@/lib/actions/user";
import { ok, badRequest, internalError } from "@/lib/api/v1/response";

/**
 * Permitted voice identifiers matching the global Voice union.
 */
const ALLOWED_VOICE_IDS = [
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Aoede",
  "Zephyr",
  "Terra",
  "Lyra",
  "Orion",
  "Ursa",
  "Nova",
  "Pegasus",
  "Hydra",
  "Leda",
  "Orus",
  "Achernar",
  "Umbriel",
] as const;

/**
 * `PATCH /api/v1/me/voice-preference` — sets the user's preferred Gemini Live
 * voice. `preferedVoiceId` is validated against the permitted Voice allowlist.
 */
const schema = z.object({
  preferedVoiceId: z.enum(ALLOWED_VOICE_IDS),
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
  if (!result.success) return internalError("Failed to update voice preference.");
  return ok(result);
}
