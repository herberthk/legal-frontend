import { requireMobileAuth } from "@/lib/api/v1/guard";
import { getTransactionStatusByReference } from "@/lib/actions/wallet";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/payments/status/:reference` — polls the status of a deposit by
 * its `reference` (the value returned from `momo/deposit` / `stripe/intent`).
 * The public web status route stays as-is; this Bearer variant additionally
 * checks the transaction belongs to the caller and 404s otherwise.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { reference } = await params;
  const result = await getTransactionStatusByReference(reference);
  const tx = "transaction" in result ? result.transaction : undefined;
  if (!result.success || !tx || tx.userId !== gate.userId) {
    return notFoundError("Transaction not found.");
  }
  return ok(result);
}
