import { getUserIdFromRequest } from "@/lib/api/v1/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { handleChatRequest } from "@/lib/api/handlers/chat";

// Allow streaming responses up to 50 seconds
export const maxDuration = 50;

/**
 * Mobile chat endpoint — the Bearer-authenticated twin of `app/api/chat/route.ts`.
 *
 * Streams the AI SDK "UI message stream" (SSE, header
 * `x-vercel-ai-ui-message-stream: v1`, `data:` frames terminated by `[DONE]`).
 * Consume with `expo/fetch` on the client — see `docs/mobile/skills/chat-streaming.md`.
 *
 * Auth + App Check are inlined here (rather than via `requireMobileAuth`) so the
 * error shape stays identical to the web route: the AI SDK client expects
 * `{ error: string }`, not the `{ error: { code, message } }` envelope.
 * The billing gotcha is unchanged: a message is only billed/persisted when a
 * non-empty `x-chat-id` header is present.
 */
export async function POST(req: Request) {
  // 0. Verify App Check token (enforced; DISABLE_APP_CHECK bypasses in dev)
  const appCheckResult = await verifyAppCheckHeader(req);
  if (!appCheckResult.valid) {
    return new Response(
      JSON.stringify({
        error: appCheckResult.error || "Unauthorized client application.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // 1. Authenticate the user (mobile: Authorization: Bearer <idToken>)
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return handleChatRequest(req, userId);
}
