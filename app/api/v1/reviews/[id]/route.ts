import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getDocumentReview, deleteDocumentReview } from "@/services/review";
import { ok, notFoundError, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/reviews/:id` — one document review.
 * `DELETE /api/v1/reviews/:id` — deletes it and returns the stored `fileUrl` so
 * the client can remove the Storage object. Ownership is enforced by the passed
 * uid; missing / not-owned → 404.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const result = await getDocumentReview(id, gate.userId);
  if (!result.success) {
    return result.notFound
      ? notFoundError(result.error || "Review not found.")
      : internalError(result.error || "Failed to retrieve review.");
  }
  return ok(result);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const result = await deleteDocumentReview(id, gate.userId);
  if (!result.success) {
    return result.notFound
      ? notFoundError(result.error || "Review not found.")
      : internalError(result.error || "Failed to delete review.");
  }
  return ok(result);
}
