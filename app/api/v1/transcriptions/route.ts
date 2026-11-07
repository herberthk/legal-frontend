import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { transcribeDocument, getTranscriptions } from "@/services/transcribe";
import { transcribePostSchema } from "@/lib/api/handlers/transcribe";
import {
  ok,
  badRequest,
  paymentRequired,
  internalError,
} from "@/lib/api/v1/response";

/**
 * `POST /api/v1/transcriptions` — runs a metered Gemini transcription over a
 * base64-encoded document (the RN client reads the picked file as base64). This
 * only transcribes + bills; persisting the result to history is a separate call
 * to `POST /api/v1/transcriptions/records` (mirrors the web, which uploads the
 * file to Storage first, then saves the record with its `fileUrl`).
 *
 * `GET /api/v1/transcriptions` — paginated history for the caller.
 */
export const maxDuration = 120;

export async function POST(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = transcribePostSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Invalid request body";
    return badRequest(message);
  }

  const result = await transcribeDocument(parsed.data, gate.userId);
  if (!result.success) {
    // Mirror the AI-route contract: out-of-credit is 402, client corrupt file is 400, everything else 500.
    if (result.errorType === "INSUFFICIENT_CREDITS") {
      return paymentRequired(result.error);
    }
    if (result.errorType === "CORRUPT_FILE") {
      return badRequest(result.error);
    }
    return internalError(result.error || "Transcription failed.");
  }
  return ok(result);
}

const timeRangeSchema = z.enum(["24h", "7d", "30d", "all"]);

export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? Math.floor(rawLimit) : 10;
  const beforeId = url.searchParams.get("beforeId") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const tr = timeRangeSchema.safeParse(url.searchParams.get("timeRange"));

  const result = await getTranscriptions(
    limit,
    beforeId,
    q,
    tr.success ? tr.data : undefined,
    gate.userId,
  );
  if (!result.success) return internalError(result.error || "Failed to retrieve transcriptions.");
  return ok(result);
}
