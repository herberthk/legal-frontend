import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getUserTransactions } from "@/lib/actions/wallet";
import { ok, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/transactions` — paginated wallet transactions for the caller.
 * Query: `page`, `pageSize` (max 50), `type` (a `TransactionType` or `ALL`),
 * `duration` (`all` | `today` | `yesterday` | `last_week` | `month`). `type` and
 * `duration` are forwarded verbatim (the action treats them as opaque filters).
 */

const DURATIONS = ["all", "today", "yesterday", "last_week", "month"] as const;

export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const rawSize = Number(url.searchParams.get("pageSize") ?? "10");
  const pageSize = Number.isInteger(rawSize) && rawSize > 0 && rawSize <= 50 ? rawSize : 10;
  const type = url.searchParams.get("type") ?? "ALL";
  // const duration = url.searchParams.get("duration") ?? "all";
  const durationParam = url.searchParams.get("duration");
  const duration =
    DURATIONS.includes(durationParam as (typeof DURATIONS)[number])
      ? (durationParam as (typeof DURATIONS)[number])
      : "all";

  const result = await getUserTransactions(gate.userId, page, pageSize, type, duration);
  if (!result.success) return internalError("Failed to retrieve transactions.");
  return ok(result);
}
