import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { transcribeDocument, getTranscriptions } from "@/services/transcribe";
import {
  ok,
  badRequest,
  paymentRequired,
  internalError,
} from "@/lib/api/v1/response";
import { MAX_REVIEW_FILE_SIZE } from "@/constants";

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

// base64 inflates bytes by 4/3
const MAX_BASE64_LENGTH = Math.ceil((MAX_REVIEW_FILE_SIZE * 4) / 3);

const postSchema = z.object({
  base64Data: z.string().min(1).max(MAX_BASE64_LENGTH),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
 ]),
  formatMode: z.enum(["professional", "original"]),
  fileName: z.string().min(1).max(300),
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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await transcribeDocument(parsed.data, gate.userId);
  if (!result.success) {
    // Mirror the AI-route contract: out-of-credit is 402, everything else 500.
    if (result.errorType === "INSUFFICIENT_CREDITS") {
      return paymentRequired(result.error);
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
