import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getVoiceSessions } from "@/lib/actions/voice";
import { ok, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/voice/sessions` — paginated Gemini Live session history for the
 * caller. Optional query: `page`, `limit`, `filter` (a `UsageFilter`),
 * `start` / `end` (`YYYY-MM-DD`, used with `filter=custom`), `q`, `tzOffset`.
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
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? Math.floor(rawLimit) : 10;

  const filterParam = url.searchParams.get("filter");
  const filter = USAGE_FILTERS.includes(filterParam as (typeof USAGE_FILTERS)[number])
    ? (filterParam as UsageFilter)
    : undefined;
  const rawStart = url.searchParams.get("start")?.trim();
  const rawEnd = url.searchParams.get("end")?.trim();
  const customRange =
    filter === "custom" && (rawStart || rawEnd)
      ? { start: rawStart || undefined, end: rawEnd || undefined }
      : undefined;
  const rawSearch = url.searchParams.get("q")?.trim();
  const searchQuery = rawSearch ? rawSearch.slice(0, 200) : undefined;
  const rawTz = url.searchParams.get("tzOffset");
  const parsedTz = rawTz !== null && rawTz.trim() !== "" ? Number(rawTz) : NaN;
  const tzOffsetMinutes = Number.isFinite(parsedTz)
    ? Math.max(-840, Math.min(840, Math.trunc(parsedTz)))
    : undefined;

  const result = await getVoiceSessions({
    userId: gate.userId,
    page,
    limit,
    filter,
    searchQuery,
    tzOffsetMinutes,
    customRange,
  });
  if (!result.success) return internalError("Failed to retrieve voice sessions.");
  return ok(result);
}
