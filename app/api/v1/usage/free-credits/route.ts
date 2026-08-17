import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getFreeCreditHistory } from "@/lib/actions/usage";
import { ok } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/usage/free-credits` — paginated history of daily free-credit
 * grants. Query: `page` (default 1), `pageSize` (default 10, max 50).
 */
export async function GET(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const rawSize = Number(url.searchParams.get("pageSize") ?? "10");
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 && rawSize <= 50 ? rawSize : 10;

  const result = await getFreeCreditHistory(gate.userId, page, pageSize);
  return ok(result);
}
