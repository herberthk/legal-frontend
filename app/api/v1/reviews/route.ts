import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getDocumentReviews, saveDocumentReview } from "@/services/review";
import { ok, badRequest, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/reviews` — paginated document-review history (cursor via
 * `beforeId`). `POST /api/v1/reviews` — persists a completed review returned by
 * `POST /api/v1/review`. Upload the source file to Storage client-side first and
 * pass its `fileUrl`. Identity comes from the token override, never the body.
 *
 * The nested arrays are validated as bounded arrays of objects (records preserve
 * their keys, so no field is silently dropped) — the authoritative shape is the
 * `review` object the analysis endpoint already returned.
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "9");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? Math.floor(rawLimit) : 9;
  const beforeId = url.searchParams.get("beforeId") ?? undefined;

  const result = await getDocumentReviews(limit, beforeId, gate.userId);
  if (!result.success) return internalError(result.error || "Failed to retrieve document reviews.");
  return ok(result);
}

const objectArray = z.array(z.record(z.string(), z.unknown())).max(500);

const saveSchema = z.object({
  fileName: z.string().min(1).max(300),
  fileUrl: z.url().max(2048),
  documentType: z.string().min(1).max(200),
  summary: z.string().max(20_000),
  overallScore: z.number().min(0).max(100),
  highlights: z.array(z.string().max(4000)).max(200),
  keyClauses: objectArray,
  risks: objectArray,
  recommendations: objectArray,
  scoreBreakdown: objectArray,
  tokensUsed: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative(),
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
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid request body");
  }

  const result = await saveDocumentReview(
    parsed.data as Omit<DocumentReview, "id" | "userId" | "createdAt" | "updatedAt">,
    gate.userId,
  );
  if (!result.success) return internalError(result.error || "Failed to save document review.");
  return ok(result);
}
