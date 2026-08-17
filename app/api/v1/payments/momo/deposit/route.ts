import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { initiateCheckoutPayment } from "@/lib/actions/payment";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/payments/momo/deposit` — initiates a PawaPay mobile-money
 * deposit and records a pending transaction, returning `{ reference }`. The
 * client then polls `GET /api/v1/payments/status/:reference`; final crediting is
 * done by the deposit webhook (unchanged). `userId` is taken from the token, not
 * the body, since this spends/credits money.
 */
const schema = z.object({
  msisdn: z.string().min(6).max(20),
  amountUgx: z.number().positive().max(7_000_000),
  amountUsd: z.number().positive().max(100_000),
  userName: z.string().max(120).optional(),
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
  if (!parsed.success) return badRequest("Invalid request body");

  const result = await initiateCheckoutPayment({
    userId: gate.userId,
    msisdn: parsed.data.msisdn,
    amountUgx: parsed.data.amountUgx,
    amountUsd: parsed.data.amountUsd,
    userName: parsed.data.userName,
  });
  return ok(result);
}
