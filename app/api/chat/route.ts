import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleChatRequest } from "@/lib/api/handlers/chat";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

/**
 * Web chat endpoint. Auth comes from the HTTP-only `session` cookie; the mobile
 * twin at `app/api/v1/chat/route.ts` resolves the user from a Bearer ID token
 * instead. Both delegate to the same `handleChatRequest` core so billing,
 * streaming, security sanitization (DOMPurify XSS protection), and file upload
 * prompt injection defenses are unified and can never diverge.
 */
export async function POST(req: Request) {
  // 0. Verify App Check token
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return new Response(
      JSON.stringify({
        error: appCheckResult.error || "Unauthorized client application.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  // 1. Authenticate the user (web: session cookie)
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // 2. Execute chat request with DOMPurify XSS defense & prompt injection protection
  const response = await handleChatRequest(req, userId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
