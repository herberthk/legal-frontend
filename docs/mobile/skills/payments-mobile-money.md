# Payments — Mobile Money (MTN / Airtel) — Mobile Agent Skill

> Top up the wallet with **MTN or Airtel mobile money** via PawaPay. Three steps:
> **verify** the number (show whose it is), **initiate** the deposit (user approves a
> PIN prompt on their phone), then **poll** for confirmation. Crediting is finalised
> **server-side by the deposit webhook** — the app never credits the balance.

## What this covers

- `POST /payments/momo/verify` — look up the registered name on a number.
- `POST /payments/momo/deposit` — start a deposit → `{ reference }`.
- `GET /payments/status/:reference` — poll until `COMPLETED`/`FAILED` (owner-guarded).
- The 3% fee, the UGX/USD/cents math, and the STK-push UX.

## The money flow (read this first)

```
[RN] POST /payments/momo/verify  { msisdn }        → { fullName, msisdn }   (confirm with user)
[RN] POST /payments/momo/deposit { msisdn, amountUgx, amountUsd }
        → { reference }                            (tx PENDING; PawaPay ACCEPTED)
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
{
  "msisdn":        "256770000000",   // 6–20 chars
  "amount":        19000,            // raw UGX integer, > 0, ≤ 7,000,000 (canonical amount)
  "userName":      "Jane Doe",       // optional, ≤ 120 chars (display only)
  "idempotencyKey": "uuid-here"      // required, ≤ 128 chars (mobile client generates one per deposit and reuses for retries)
}
→ 200 { "data": { "success": true, "data": {
    "reference":     "…",        // use this for status polling
    "transactionId": "…",
    "status":        "ACCEPTED"  // PawaPay accepted the request (not yet paid)
} } }
→ 200 { "data": { "success": false, "error": "Failed to initiate payment, Try again" } }
```

- **`amount` is the base amount in UGX.** The server adds a **3% mobile-money fee**
  on top (`total = amount + fee`) — that total is what the user is charged on their
  phone.
- **USD amount is derived server-side** using the trusted exchange rate:
  `amountUsd = amount / 3800` (stored on the transaction in cents = `amountUsd × 100`).
  Clients do not supply `amountUsd`.
- **`idempotencyKey` is required** for safe retries. The mobile client generates one
  UUID per deposit intent and reuses it for all retries of that deposit. The server
  deduplicates by this key, returning the existing transaction if one matches.
- `status: "ACCEPTED"` means **PawaPay queued it and pushed a PIN prompt to the
  phone** — it is *not* payment confirmation. Wait for the webhook via polling.

```ts
// Generate one idempotency key per deposit intent
const idempotencyKey = generateUUID();

const res = await apiFetch<{
  success: boolean;
  data?: { reference: string; transactionId: string; status: string };
  error?: string;
}>("/payments/momo/deposit", {
  method: "POST",
  body: JSON.stringify({ msisdn, amount, userName, idempotencyKey }),
});
if (!res.success || !res.data) throw new Error(res.error ?? "Could not start the deposit.");
const { reference } = res.data;   // → poll this

// On network failure, retry with the SAME idempotencyKey
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
- **Poll with backoff and a cap.** 3 s interval, ~90 s ceiling; on `TIMEOUT` fall back
  to "processing" + a manual refresh rather than blocking the UI forever. The webhook
  may still confirm after you stop polling — `/me` will reflect it on next fetch.
- **Refetch `/me` after `COMPLETED`** for the new balance; don't add it client-side.
- **Guide the PIN prompt.** After `ACCEPTED`, tell the user to check their phone and
  enter their mobile-money PIN — the app can't trigger or read that dialog.
- **Do money math in one place.** UGX ↔ USD ↔ cents conversions belong in a single
  helper (see `billing-and-usage.md`); don't scatter `3800`/`100`.

## Performance notes

- Keep polling lightweight — a single small GET every few seconds. Stop immediately on
  a terminal status; don't keep a timer alive after the screen unmounts.
- Debounce the "Pay" button and disable it while a deposit is in flight to avoid
  double-initiating (each call creates a new `PENDING` transaction).

## Gotchas

- **`ACCEPTED` ≠ paid.** It only means PawaPay queued the STK/PIN push. Confirmation
  comes from the webhook; always poll `status`.
- **The user pays `amountUgx` + 3% fee**, but the wallet credits the `amountUsd`
  value. Surface the fee so the phone charge isn't a surprise.
- Both `verify` and `deposit` are enveloped **and** carry an inner `success` — check
  `data.success`, and read the failure text from `data.error` (not `error.message`).
- `GET /payments/status/:reference` is **owner-guarded → 404** for a foreign/unknown
  reference. Don't treat 404 as "still pending"; it means "not yours / doesn't exist".
- `msisdn` must be the full Ugandan number (`256…`). The network (MTN/Airtel) is
  inferred server-side — don't send it.
- Provider webhooks are server-to-server; the app must **never** call
  `/api/webhooks/deposit`.
