import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getVoiceSessions } from "@/lib/actions/voice";
import { ok } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/voice/sessions` — paginated Gemini Live session history for the
 * caller. Optional query: `page`, `limit`, `filter` (a `UsageFilter`), `q`.
 * (`getVoiceSessions` lives outside the `@/lib` barrel — imported by full path.)
 */
const USAGE_FILTERS = ["today", "yesterday", "last_week", "month", "custom"] as const;

export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const rawLimit = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 10;

  const filterParam = url.searchParams.get("filter");
  const filter = USAGE_FILTERS.includes(filterParam as (typeof USAGE_FILTERS)[number])
    ? (filterParam as UsageFilter)
    : undefined;
  const searchQuery = url.searchParams.get("q") ?? undefined;

  const result = await getVoiceSessions({
    userId: gate.userId,
    page,
    limit,
    filter,
    searchQuery,
  });
  return ok(result);
}
