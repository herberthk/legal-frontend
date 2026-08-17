# Payments — Stripe (Card) — Mobile Agent Skill

> Top up the wallet with a credit/debit card. The device creates a **PaymentIntent**
> via the API, then confirms it locally with **`@stripe/stripe-react-native`**. The
> wallet is credited **server-side by the Stripe webhook** — the app never credits
> the balance itself.

## What this covers

- `POST /payments/stripe/intent` — create a PaymentIntent → `clientSecret`.
- Confirming the payment on-device with the Stripe RN SDK (Payment Sheet).
- How crediting actually completes (webhook) and how to reflect it in the UI.
- Amounts, currency, and the cents/USD/UGX distinction.

## The money flow (read this first)

```
[RN] POST /payments/stripe/intent { amountInDollars }
        → { clientSecret, transactionId, reference }   (tx is PENDING in Firestore)
[RN] Stripe SDK confirms clientSecret (Payment Sheet)  → card charged
[Stripe] → webhook → /api/webhooks/stripe (server)     → tx COMPLETED, balance credited
[RN] refetch GET /me (or poll /payments/status/:reference) → new balance
```

Two things never happen on the device: **you never credit the balance**, and **you
never call the webhook**. The device's only jobs are (1) ask for a `clientSecret`
and (2) confirm the card with Stripe. Everything financial is settled server-to-server.

## Endpoint — create the intent

Enveloped (`{ data }` / `{ error }`), so it goes through `apiFetch`.

```
POST /payments/stripe/intent
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
{ "amountInDollars": 5 }          // USD; > 0, ≤ 100000
→ 200 { "data": {
    "success": true,
    "clientSecret": "pi_3Q…_secret_…",
    "transactionId": "pi_3Q…",     // = the Stripe PaymentIntent id / Firestore tx id
    "reference": "TX-…"            // your internal reference; use for status polling
} }
→ 200 { "data": { "success": false, "message": "…" } }   // creation failed (still HTTP 200)
```

- **`amountInDollars` is USD**, not cents and not UGX. The server converts to cents
  (`× 100`) for Stripe. If your UI collects UGX, divide by the exchange rate first
  (see `billing-and-usage.md`): `amountInDollars = ugx / 3800`.
- The response is enveloped, but the **operation result** carries its own `success`
  flag — check `data.success` before using `clientSecret` (a Stripe error comes back
  as `success:false` + `message`, HTTP 200).
- The transaction is written **`PENDING`**; it flips to `COMPLETED` only when the
  webhook fires after a successful charge.

## RN implementation — `@stripe/stripe-react-native`

```
npx expo install @stripe/stripe-react-native
```

Wrap the app (or the top-up screen) in `StripeProvider` with your **publishable**
key (`pk_…`, safe on the client — never the secret key):

```tsx
import { StripeProvider } from "@stripe/stripe-react-native";

<StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
  <TopUpScreen />
</StripeProvider>;
```

Create the intent, then present the Payment Sheet:

```ts
import { useStripe } from "@stripe/stripe-react-native";

export function useCardTopUp() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return async function topUp(amountInDollars: number) {
    // 1. Ask the API for a PaymentIntent
    const intent = await apiFetch<{
      success: boolean;
      clientSecret: string;
      transactionId: string;
      reference: string;
    }>("/payments/stripe/intent", {
      method: "POST",
      body: JSON.stringify({ amountInDollars }),
    });
    if (!intent.success) throw new Error("Could not start the card payment.");

    // 2. Initialise the Payment Sheet with the clientSecret
    const init = await initPaymentSheet({
      merchantDisplayName: "Legal Adviser",
      paymentIntentClientSecret: intent.clientSecret,
      // Optional: enable saved cards, Apple/Google Pay, etc. here.
    });
    if (init.error) throw new Error(init.error.message);

    // 3. Present it — the user enters card details and confirms
    const { error } = await presentPaymentSheet();
    if (error) {
      if (error.code === "Canceled") return { cancelled: true, reference: intent.reference };
      throw new Error(error.message);
    }

    // 4. Charged. Crediting is finalised by the webhook; reconcile below.
    return { cancelled: false, reference: intent.reference };
  };
}
```

## Reflecting the credit (webhook lag)

`presentPaymentSheet` resolving without error means **the card was charged**, but the
balance may not be credited for a beat — the Stripe webhook has to reach the server
first. Reconcile with either:

- **Refetch `/me`** after a short delay and on screen focus (simplest). The balance
  updates once the webhook lands.
- **Poll `GET /payments/status/:reference`** with the `reference` you got back until
  `status === "COMPLETED"` (see `payments-mobile-money.md` for the polling helper —
  it's the same route). Cap the poll (e.g. 60 s) and fall back to "processing —
  pull to refresh".

```ts
const { cancelled, reference } = await topUp(5);
if (!cancelled) {
  await pollUntilSettled(reference);     // shared helper (payments-mobile-money.md)
  await refetchMe();                     // refresh the wallet
}
```

## Best practices

- **Use the Payment Sheet** (`initPaymentSheet` + `presentPaymentSheet`), not the raw
  `CardField` + `confirmPayment`, unless you need a fully custom form. The sheet
  handles 3-D Secure, wallets, and validation for you.
- **Publishable key only on the device.** The secret key lives on the server; the
  publishable `pk_…` is the sole Stripe key that belongs in the RN bundle.
- **Treat "sheet closed OK" as _charged_, not _credited_.** Always reconcile against
  `/me` or `/payments/status/:reference`; don't optimistically add to the balance.
- **Handle `Canceled`** distinctly from a real failure — the user backing out isn't
  an error to surface loudly.
- **Idempotent from the user's view:** if a top-up screen is retried, each attempt
  creates a fresh PaymentIntent; abandoned `PENDING` intents cost nothing.

## Performance notes

- `initPaymentSheet` does a network round-trip; show a spinner between "Pay" and the
  sheet appearing, and pre-init as soon as the amount is chosen if you want it instant.
- Keep the publishable key and `StripeProvider` mounted once high in the tree; don't
  re-create the provider per screen.

## Gotchas

- **`amountInDollars` is dollars.** Passing cents (e.g. `500` for $5) charges $500.
  Convert UGX → USD before calling.
- The route's outer envelope is `{ data }`, but the inner object has its **own**
  `success` — a failed intent is `{ data: { success: false, message } }` at HTTP 200,
  not an `{ error }` body. Check `data.success`.
- **Never** look for a `STRIPE_SECRET_KEY` on the client — only `pk_…` publishable
  keys are safe in the app.
- The webhook is the source of truth for crediting. If you skip reconciliation the
  UI will show a stale balance even though the top-up succeeded.
- `reference` (your `TX-…`) and `transactionId` (the Stripe `pi_…`) are different
  ids; use **`reference`** for `GET /payments/status/:reference`.
