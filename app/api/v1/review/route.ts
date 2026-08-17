import { getUserIdFromRequest } from "@/lib/api/v1/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleReviewRequest } from "@/lib/api/handlers/review";

export const maxDuration = 120;

/**
 * Mobile document-review endpoint — the Bearer-authenticated twin of
 * `app/api/review/route.ts`. Accepts `multipart/form-data` with a single `file`
 * field (PDF / DOCX / image) and returns the structured `{ review }` payload.
 * See `docs/mobile/skills/document-review.md`.
 *
 * Auth + App Check are inlined (not via `requireMobileAuth`) so the error shape
 * stays identical to the web route (`{ error: string }`).
 */
export async function POST(req: Request) {
  // 0. Verify App Check token (enforced; DISABLE_APP_CHECK bypasses in dev)
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return Response.json(
      { error: appCheckResult.error || "Unauthorized client application." },
      { status: 401 },
    );
  }

  // 1. Authenticate user (mobile: Authorization: Bearer <idToken>)
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  return handleReviewRequest(req, userId);
}
