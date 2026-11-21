import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getVoiceSessionById } from "@/lib/actions/voice";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/voice/sessions/:id` — one voice session. `getVoiceSessionById`
 * has no owner check, so the route compares the returned doc's `userId` to the
 * caller and returns 404 on mismatch (never 403).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  // Reject ids that cannot be valid Firestore doc names — same character set
  // as the sessionId regex in the billing route to prevent path traversal.
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return notFoundError("Voice session not found.");
  }
  const session = await getVoiceSessionById(id);
  if (!session || session.userId !== gate.userId) {
    return notFoundError("Voice session not found.");
  }
  return ok(session);
}
