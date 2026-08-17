import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { saveTranscriptionRecord } from "@/services/transcribe";
import { ok, badRequest, notFoundError } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/transcriptions/records` — persists a completed transcription to
 * the caller's history. The web equivalent (`saveTranscriptionRecord`) resolves
 * identity from the session cookie; the v1 route passes the token-verified uid
 * as the override so `userId` is never client-supplied. Pass `id` to update an
 * existing record, omit it to create. Upload the source file to Firebase Storage
 * client-side first and pass its `fileUrl`.
 */
const schema = z.object({
  id: z.string().min(1).max(128).optional(),
  title: z.string().min(1).max(300),
  fileName: z.string().min(1).max(300),
  fileUrl: z.url().max(2048).optional(),
  transcribedText: z.string().min(1).max(900_000),
  formatMode: z.enum(["professional", "original"]),
  tokensUsed: z.number().int().nonnegative().optional(),
});

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
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid request body");
  }

  const result = await saveTranscriptionRecord(parsed.data, gate.userId);
  if (!result.success) {
    return notFoundError(result.error || "Failed to save transcription record.");
  }
  return ok(result);
}
