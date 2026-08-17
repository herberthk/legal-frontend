import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleReviewRequest } from "@/lib/api/handlers/review";

export const maxDuration = 120;

/**
 * Web document-review endpoint. Auth comes from the HTTP-only `session` cookie;
 * the mobile twin at `app/api/v1/review/route.ts` resolves the user from a
 * Bearer ID token instead. Both delegate to the same `handleReviewRequest` core
 * so billing and analysis behaviour can never diverge.
 */
export async function POST(req: Request) {
  // 0. Verify App Check token
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return Response.json(
      { error: appCheckResult.error || "Unauthorized client application." },
      { status: 401 },
    );
  }

  // 1. Authenticate user (web: session cookie)
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleReviewRequest(req, userId);
}
