# Payments — Mobile Money (MTN / Airtel) — Mobile Agent Skill

> Top up the wallet with **MTN or Airtel mobile money** via PawaPay. Three steps:
> **verify** the number (show whose it is), **initiate** the deposit (user approves a
> PIN prompt on their phone), then **poll** for confirmation. Crediting is finalised
> **server-side by the deposit webhook** — the app never credits the balance.

## What this covers

- `POST /payments/momo/verify` — look up the registered name on a number.
- `POST /payments/momo/deposit` — start a deposit → `{ reference }`. **Requires an
  `idempotencyKey`** — see Step 2, it is the single most common integration mistake.
- `GET /payments/status/:reference` — poll until `COMPLETED`/`FAILED` (owner-guarded).
- The 3% fee, the UGX/USD/cents math, and the STK-push UX.

## The money flow (read this first)

```
[RN] POST /payments/momo/verify  { msisdn }        → { fullName, msisdn }   (confirm with user)
[RN] POST /payments/momo/deposit { msisdn, amount, idempotencyKey, userName? }
        → 200 { reference, transactionId, status }  (tx PENDING; PawaPay ACCEPTED)
        → 400  terminal    — do NOT retry this key
        → 503  retryable   — retry with the SAME key
[phone] user approves the mobile-money PIN prompt
[PawaPay] → webhook → /api/webhooks/deposit (server) → tx COMPLETED, balance credited
[RN] poll GET /payments/status/:reference until COMPLETED → refetch GET /me
```

As with cards: the device **never credits the balance** and **never calls the
webhook**. It initiates and then watches for the result.

## Step 1 — verify the number

Confirms the account name so the user can sanity-check before a charge. Enveloped
(`apiFetch`).

```
POST /payments/momo/verify
{ "msisdn": "256770000000" }        // 6–20 chars; Ugandan MSISDN
→ 200 { "data": { "success": true, "data": { "fullName": "Jane Doe", "msisdn": "256770000000" } } }
→ 200 { "data": { "success": false, "error": "Failed to verify phone number" } }
```

- `msisdn` is the Ugandan number in `256XXXXXXXXX` form. The server detects MTN vs
  Airtel from the prefix; you don't send the network.
- The inner object has its **own** `success` — a failed lookup is `success:false` at
  HTTP 200, not an `{ error }` body.

```ts
const res = await apiFetch<{ success: boolean; data?: { fullName: string; msisdn: string }; error?: string }>(
  "/payments/momo/verify",
  { method: "POST", body: JSON.stringify({ msisdn }) },
);
if (!res.success) showError("We couldn't verify that number.");
else confirmWithUser(res.data!.fullName);   // "Send to Jane Doe?"
```

## Step 2 — initiate the deposit

```
POST /payments/momo/deposit
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
{
  "msisdn":         "256770000000",   // 6–20 chars
  "amount":         19000,            // UGX number (rounded by Math.round), 1,000 – 7,000,000
  "idempotencyKey": "b2f1…",          // REQUIRED, 1–128 chars — see below
}
→ 200 { "data": {
    "reference":     "…",        // use this for status polling
    "transactionId": "…",
    "status":        "ACCEPTED" | "PENDING"  // current claim/provider status
} }
→ 400 { "error": { "code": "BAD_REQUEST", "message": "…" } }   # terminal — do NOT retry this key
→ 401 { "error": { "code": "UNAUTHENTICATED", "message": "Authentication required." } }
→ 503 { "error": { "code": "INTERNAL", "message": "…" } }      # retryable — retry the SAME key
```

### `idempotencyKey` is mandatory

Omitting it fails the request outright with
**`400 idempotencyKey is required for deposit requests`**. It exists so a retried or
double-tapped deposit cannot charge the user twice.

- Generate **one key per user intent** (per press of "Pay"), not per HTTP attempt.
  Keep it for the lifetime of that attempt and reuse it on every retry.
- Send it **either** as the `idempotencyKey` body field **or** as an
  `Idempotency-Key` / `X-Idempotency-Key` header. The body field wins if both are
  present.
- Any string, 1–128 chars — a UUID is the obvious choice. Use `uuid.v4()` from
  the `uuid` package after importing the `react-native-get-random-values`
  polyfill to ensure cryptographic randomness.

**Replay semantics.** Re-posting a key that already has a live claim returns
**`200` with the original `reference`, `transactionId` and `status`** — no second
charge, no new transaction. The returned `status` reflects the current state of
the claim at the time of the request; idempotent retries may return 200 with
`PENDING` for an existing claim that has not yet been accepted by the provider.
This status does not indicate settlement — clients must continue polling the
reference for the final outcome. The one exception: if the earlier attempt
reached a terminal failure, the replay returns
**`400 Previous payment attempt with this key has failed. Please start a new payment.`** —
mint a fresh key at that point.

### Amount

- **`amount` is the base amount in UGX**, min **1,000**, max **7,000,000**. Values
  outside that range are rejected with
  `400 Invalid payment amount. Must be between 1,000 and 7,000,000 UGX`.
- `amountUgx` is accepted as an alias if you prefer that name; send **one** of the
  two. Sending neither is `400 Either amount or amountUgx is required`.
- The server adds a **3% mobile-money fee** on top (`total = amount + fee`) — that
  total is what the user is charged on their phone.
- **USD amount is derived server-side** using the trusted exchange rate:
  `amountUsd = amount / 3800` (stored on the transaction in cents = `amountUsd × 100`).
  Clients do not supply `amountUsd`; a client-sent `amountUsd` is ignored.
- `status: "ACCEPTED"` means **PawaPay queued it and pushed a PIN prompt to the
  phone** — it is *not* payment confirmation. Wait for the webhook via polling.

### 400 vs 503 — the retry rule

This endpoint never returns HTTP 200 for a failed deposit, so you can branch on the
status code alone.

| Status | Meaning | What to do |
|---|---|---|
| **400** | Terminal. Bad input, provider rejected it definitively, or this key already failed. | Show the message. **Do not retry this key.** Fix the input / mint a new key. |
| **503** | Retryable. Provider timeout, rate limit, or 5xx — the deposit may still settle. | Retry with the **same** `idempotencyKey`, with backoff. Then poll status regardless. |

Typical `503` messages: `Network timeout communicating with payment provider. Please
check your phone or retry.` / `Payment provider is temporarily unavailable. Please try
again in a moment.` On a timeout the PIN prompt may already be on the user's phone —
say so, and start polling instead of silently failing.

```ts
import { v4 as uuidv4 } from "uuid";
import "react-native-get-random-values";

// One key per user intent — generated when the user presses Pay, reused on retries.
const idempotencyKey = uuidv4();

async function startDeposit() {
  try {
    const { reference } = await apiFetch<{
      reference: string;
      transactionId: string;
      status: string;
    }>("/payments/momo/deposit", {
      method: "POST",
      body: JSON.stringify({ msisdn, amount, idempotencyKey }),
    });
    return reference;                     // → poll this
  } catch (err) {
    // apiFetch throws ApiError { status, code, message } — see error-handling.md
    if (err instanceof ApiError && err.status === 503) {
      return retryWithSameKey(idempotencyKey);  // safe
    }
    throw err;                                  // 400 → terminal
  }
}
```

## Step 3 — poll for confirmation

The deposit completes only when the user approves the PIN prompt **and** PawaPay's
webhook reaches the server. Poll the owner-guarded status route until it settles.

```
GET /payments/status/:reference
→ 200 { "data": { "success": true, "status": "COMPLETED" | "PENDING" | "FAILED", "transaction": Transaction } }
→ 404 NOT_FOUND        # unknown reference OR not the caller's transaction
```

- This route **checks ownership** — a reference that isn't yours returns **404**
  (never 403). Only poll references you just created.
- `status` mirrors the Firestore transaction: `PENDING` until the webhook lands, then
  `COMPLETED` (credited) or `FAILED` (declined / timed out / insufficient funds).

```ts
// Shared poller (also used by payments-stripe.md).
export async function pollUntilSettled(
  reference: string,
  { intervalMs = 3000, timeoutMs = 90_000 } = {},
): Promise<"COMPLETED" | "FAILED" | "TIMEOUT"> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let res: { success: boolean; status: string } | null = null;
    try {
      res = await apiFetch<{ success: boolean; status: string }>(
        `/payments/status/${encodeURIComponent(reference)}`,
      );
    } catch (err: unknown) {
      // Only swallow genuine transient network blips (no response at all).
      // Re-throw auth failures, 404 (wrong reference / ownership), and any
      // structured API error so they surface immediately instead of retrying.
      const isNetworkBlip =
        err instanceof TypeError ||
        (err instanceof Error && err.message.toLowerCase().includes("network"));
      if (!isNetworkBlip) throw err;
      // Transient blip — wait and retry.
    }
    const status = res?.status;
    if (status === "COMPLETED" || status === "FAILED") return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return "TIMEOUT";
}
```

> `Date.now()` is fine in an RN app — the "no `Date.now`" restriction only applies to
> Workflow scripts, not to shipped client code.

Then reconcile the wallet:

```ts
const status = await pollUntilSettled(reference);
if (status === "COMPLETED") await refetchMe();        // balance now updated
else if (status === "FAILED") showError("The payment didn't go through.");
else showInfo("Still processing — pull to refresh in a moment.");   // TIMEOUT
```

## Best practices

- **Verify → confirm → deposit.** Always show the resolved `fullName` and the **total
  incl. fee** before initiating, so the user recognises the charge on their phone.
- **Mint the `idempotencyKey` when the user presses Pay**, store it in that screen's
  state, and reuse it for every retry of that same intent. A fresh key per HTTP attempt
  defeats the entire protection and can double-charge.
- **Poll with backoff and a cap.** 3 s interval, ~90 s ceiling; on `TIMEOUT` fall back
  to "processing" + a manual refresh rather than blocking the UI forever. The webhook
  may still confirm after you stop polling — `/me` will reflect it on next fetch.
- **Retry with the same idempotency key after a `503` until you receive a `200`
  response with the generated `reference`.** Once you have the reference, begin
  status polling — do not poll before obtaining that reference.
- **Refetch `/me` after `COMPLETED`** for the new balance; don't add it client-side.
- **Guide the PIN prompt.** After `ACCEPTED`, tell the user to check their phone and
  enter their mobile-money PIN — the app can't trigger or read that dialog.
- **Do money math in one place.** UGX ↔ USD ↔ cents conversions belong in a single
  helper (see `billing-and-usage.md`); don't scatter `3800`/`100`.

## Performance notes

- Keep polling lightweight — a single small GET every few seconds. Stop immediately on
  a terminal status; don't keep a timer alive after the screen unmounts.
- Debounce the "Pay" button and disable it while a deposit is in flight. With a stable
  `idempotencyKey` a double-tap is harmless (the second call replays the first), but
  it still costs a round-trip.

## Gotchas

- **`idempotencyKey` is required.** No key → `400 idempotencyKey is required for
  deposit requests`. It's the most common cause of a deposit integration failing on
  first run.
- **One key per intent, not per attempt.** Reuse the same key across retries of one
  "Pay" press; mint a new one only for a genuinely new payment.
- **`ACCEPTED` ≠ paid.** It only means PawaPay queued the STK/PIN push. Confirmation
  comes from the webhook; always poll `status`.
- **The user pays `amount` + 3% fee**, but the wallet credits the derived `amountUsd`
  value. Surface the fee so the phone charge isn't a surprise.
- **`amountUsd` is not an input.** It's computed server-side from the trusted rate;
  sending it does nothing.
- **The minimum is 1,000 UGX** — not 1. Below that (or above 7,000,000) is a `400`.
- **`deposit` has no inner `success` flag; `verify` does.** Deposit failures are real
  HTTP statuses (`400`/`503`) with `error.message`. Verify returns
  `200 { data: { success, … } }` and a failed lookup is `success:false` at HTTP 200 —
  read its failure text from `data.error`, not `error.message`. Don't apply one shape
  to the other.
- **`400` means don't retry that key; `503` means retry the same key.** Retrying a
  `400` with the same key just returns the same failure.
- `GET /payments/status/:reference` is **owner-guarded → 404** for a foreign/unknown
  reference. Don't treat 404 as "still pending"; it means "not yours / doesn't exist".
- `msisdn` must be the full Ugandan number (`256…`). The network (MTN/Airtel) is
  inferred server-side — don't send it.
- Provider webhooks are server-to-server; the app must **never** call
  `/api/webhooks/deposit`.
