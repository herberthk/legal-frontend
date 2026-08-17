import { getAuthenticatedUserId } from "@/lib";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleChatRequest } from "@/lib/api/handlers/chat";

// Allow streaming responses up to 50 seconds
export const maxDuration = 50;

/**
 * Web chat endpoint. Auth comes from the HTTP-only `session` cookie; the mobile
 * twin at `app/api/v1/chat/route.ts` resolves the user from a Bearer ID token
 * instead. Both delegate to the same `handleChatRequest` core so billing and
 * streaming behaviour can never diverge.
 */
export async function POST(req: Request) {
  // 0. Verify App Check token
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return new Response(
      JSON.stringify({
        error: appCheckResult.error || "Unauthorized client application.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Authenticate the user (web: session cookie)
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return handleChatRequest(req, userId);
}
