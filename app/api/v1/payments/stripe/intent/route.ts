import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { initiateStripePayment } from "@/lib/actions/wallet";
import { ok, badRequest } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/payments/stripe/intent` — creates a Stripe PaymentIntent and a
 * pending transaction, returning `clientSecret` for `@stripe/stripe-react-native`
 * to confirm on-device. Crediting happens later via the Stripe webhook (unchanged
 * server-to-server). Amount is USD; `userId` comes from the token.
 */
const schema = z.object({
  amountInDollars: z.number().positive().max(100_000),
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

  const result = await initiateStripePayment(gate.userId, parsed.data.amountInDollars);
  return ok(result);
}
