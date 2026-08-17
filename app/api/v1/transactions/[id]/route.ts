import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getTransaction } from "@/lib/actions/wallet";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/transactions/:id` — one transaction. `getTransaction` has no
 * owner check, so the route verifies the returned doc's `userId` matches the
 * caller and returns 404 on mismatch (never 403 — ids stay unprobeable).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const result = await getTransaction(id);
  const tx = "transaction" in result ? result.transaction : undefined;
  if (!result.success || !tx || tx.userId !== gate.userId) {
    return notFoundError("Transaction not found.");
  }
  return ok(result);
}
