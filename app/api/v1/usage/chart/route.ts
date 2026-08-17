import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getUsageChartData } from "@/lib/actions/usage";
import { ok } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/usage/chart` — aggregated usage series for charts. Query:
 * `filter` (a `UsageFilter`, default `last_week`), `start`/`end` for custom, and
 * `timezoneOffset` (minutes, as from JS `Date.getTimezoneOffset()`) so buckets
 * align to the device's local day.
 */
const USAGE_FILTERS = ["today", "yesterday", "last_week", "month", "custom"] as const;

export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const filterParam = url.searchParams.get("filter");
  const filter = USAGE_FILTERS.includes(filterParam as (typeof USAGE_FILTERS)[number])
    ? (filterParam as UsageFilter)
    : "last_week";

  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const customRange =
    filter === "custom" && start && end ? { start, end } : undefined;

  const tzRaw = Number(url.searchParams.get("timezoneOffset") ?? "0");
  const timezoneOffset = Number.isFinite(tzRaw) ? tzRaw : 0;

  const result = await getUsageChartData(
    gate.userId,
    filter,
    customRange,
    timezoneOffset,
  );
  return ok(result);
}
