import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleTranscribeRequest } from "@/lib/api/handlers/transcribe";

// Allow up to 2 minutes for Gemini to process large multi-page documents
export const maxDuration = 120;

/**
 * Web document-transcription endpoint. Auth comes from the HTTP-only `session`
 * cookie; the mobile twin at `app/api/v1/transcriptions/route.ts` resolves the
 * user from a Bearer ID token instead. Both delegate to the same
 * `handleTranscribeRequest` core so billing, AI call, and usage deduction are
 * unified and can never diverge.
 *
 * Request body (JSON):
 * {
 *   base64Data: string,       // base64-encoded file bytes (≤10 MB source)
 *   mimeType:   "application/pdf" | "image/png" | "image/jpeg" | "image/webp",
 *   formatMode: "professional" | "original",
 *   fileName:   string        // 1–300 chars
 * }
 */
export async function POST(req: Request) {
  // 0. Verify App Check token
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return Response.json(
      { error: appCheckResult.error || "Unauthorized client application." },
      {
        status: 401,
        headers: { "X-Content-Type-Options": "nosniff" },
      },
    );
  }

  // 1. Authenticate user (web: session cookie)
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return Response.json(
      { error: "Authentication required." },
      {
        status: 401,
        headers: { "X-Content-Type-Options": "nosniff" },
      },
    );
  }

  // 2. Execute transcription (credit check, AI call, usage deduction)
  const response = await handleTranscribeRequest(req, userId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

