import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getUserUsage } from "@/lib/actions/usage";
import { ok } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/usage` — metered-usage records for the caller over a window.
 * Query: `filter` (a `UsageFilter`, default `today`) and, when `filter=custom`,
 * `start` + `end` ISO dates.
 */
const USAGE_FILTERS = ["today", "yesterday", "last_week", "month", "custom"] as const;

export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const filterParam = url.searchParams.get("filter");
  const filter = USAGE_FILTERS.includes(filterParam as (typeof USAGE_FILTERS)[number])
    ? (filterParam as UsageFilter)
    : "today";

  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const customRange =
    filter === "custom" && start && end ? { start, end } : undefined;

  const result = await getUserUsage(gate.userId, filter, customRange);
  return ok(result);
}
