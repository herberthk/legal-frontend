import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { initiateDeposit } from "@/services/payment";
import { ok, badRequest, apiError } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/payments/momo/deposit` — initiates a PawaPay mobile-money
 * deposit and records a pending transaction, returning `{ reference }`. The
 * client then polls `GET /api/v1/payments/status/:reference`; final crediting is
 * done by the deposit webhook (unchanged). `userId` is taken from the token, not
 * the body, since this spends/credits money.
 *
 * Calls `initiateDeposit` (in `services/payment.ts`) rather than the
 * `initiateCheckoutPayment` server action: that action resolves identity from the
 * web `session` cookie, which a Bearer client never sends, so it would always
 * fail here. See `docs/mobile/skills/payments-mobile-money.md`.
 */
const schema = z.object({
  msisdn: z.string().min(6).max(20),
  amount: z.number().min(1000).max(7_000_000).optional(),
  amountUgx: z.number().min(1000).max(7_000_000).optional(),
  userName: z.string().max(120).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
}).refine((data) => data.amount !== undefined || data.amountUgx !== undefined, {
  message: "Either amount or amountUgx is required",
});

export async function POST(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid request body");

  const headerIdempotencyKey =
    req.headers.get("idempotency-key") ||
    req.headers.get("x-idempotency-key") ||
    undefined;
  const idempotencyKey = parsed.data.idempotencyKey || headerIdempotencyKey;

  if (!idempotencyKey) {
    return badRequest("idempotencyKey is required for deposit requests");
  }

  const canonicalAmount = parsed.data.amount ?? parsed.data.amountUgx!;

  const result = await initiateDeposit({
    userId: gate.userId,
    msisdn: parsed.data.msisdn,
    amount: canonicalAmount,
    userName: parsed.data.userName,
    idempotencyKey,
  });

  // Never return HTTP 200 for a failed deposit — the client must be able to
  // branch on status alone. `terminal: true` means "do not retry this key"
  // (400); `terminal: false` means the provider may still settle or the call is
  // safely retryable with the SAME key (503).
  if (!result.success) {
    return result.terminal
      ? badRequest(result.error)
      : apiError(503, "INTERNAL", result.error);
  }

  return ok(result.data);
}
