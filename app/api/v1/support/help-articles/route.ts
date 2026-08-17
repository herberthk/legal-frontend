import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getHelpArticles } from "@/lib/actions/support";
import { ok, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/support/help-articles` — FAQ/help content, optionally filtered by
 * `?category=`. Authenticated + App Check like the rest of the mobile surface
 * (the web loads these from the signed-in dashboard).
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;

  const result = await getHelpArticles(category);
  if (!result.success) return internalError(result.error);
  return ok(result.articles);
}
