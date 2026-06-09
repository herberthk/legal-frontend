# Ssentezo Wallet SDK

A fully-typed TypeScript SDK for the [Ssentezo Wallet API](https://wallet.ssentezo.com/documentation) — Uganda's mobile money payment platform.

Built for **Next.js App Router** with first-class support for Server Components, Server Actions, and Route Handlers. Works in any Node.js ≥ 18 or Edge Runtime environment.

---

## Features

- ✅ Full TypeScript types for every request and response
- ✅ HTTP Basic Auth with Node.js `Buffer` and Edge Runtime fallback
- ✅ Automatic retry with full-jitter exponential back-off
- ✅ Per-request timeout with `AbortController`
- ✅ Client-side input validation before any HTTP call
- ✅ In-memory bank list caching (configurable TTL)
- ✅ Polling helper with configurable interval and timeout
- ✅ `parseCallbackPayload()` utility for safe webhook handling
- ✅ `generateReference()` for cryptographically random transaction IDs
- ✅ Next.js `cache: "no-store"` on all financial requests
- ✅ Dev-mode singleton to survive HMR reloads
- ✅ Structured error hierarchy for precise error handling
- ✅ **`withSsentezo()`** — zero-boilerplate wrapper for Server Actions
- ✅ **`handleSsentezoRouteError()`** — one-liner error response for Route Handlers
- ✅ **`handleSsentezoError()`** — typed error classifier when you need to branch on kind

---

## Project Structure

```
lib/
└── ssentezo/
    ├── index.ts            ← Main entry point & re-exports
    ├── types.ts            ← All TypeScript interfaces and types
    ├── errors.ts           ← Custom error classes + type guards
    ├── error-handler.ts    ← withSsentezo / handleSsentezoError / handleSsentezoRouteError
    ├── validators.ts       ← Pre-flight input validation
    ├── client.ts           ← Core HTTP client (retry, timeout, auth)
    ├── utils.ts            ← Helpers (generateReference, parseCallbackPayload, …)
    ├── resources/
    │   ├── balance.ts      ← wallet.balance
    │   ├── msisdn.ts       ← wallet.msisdn
    │   ├── transactions.ts ← wallet.transactions
    │   └── bank-transfer.ts← wallet.bankTransfer
    └── hooks/
        └── useTransactionStatus.ts ← Client-side polling hook
```

---

## Setup

### 1. Copy the SDK

Copy the `lib/ssentezo/` folder into your Next.js project at the same path.

### 2. Environment Variables

Add to your `.env.local` (and your production environment):

```env
# Required
SSENTEZO_API_USER=your_api_user
SSENTEZO_API_KEY=your_api_key

# Optional — defaults to "live"
SSENTEZO_ENV=sandbox

# Your app's public base URL (used to build callback URLs)
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

> **Never** expose `SSENTEZO_API_USER` or `SSENTEZO_API_KEY` to the client.
> They are read only on the server. The SDK enforces this by design.

### 3. Create a Shared Instance

```typescript
// lib/payments.ts
import "server-only";                  // Build-time guard: import fails on client
import { getSsentezoWallet } from "@/lib/ssentezo";

export const wallet = getSsentezoWallet();
```

Add `"server-only"` at the top of any file that imports the SDK to get a
hard build-time error if it ever accidentally ends up in a client bundle.

Install the package if you haven't already:
```bash
npm install server-only
```

---

## Quick Reference

```typescript
import { wallet } from "@/lib/payments";

// Check balance
const balance = await wallet.balance.check();

// Verify a phone number before transacting
const info = await wallet.msisdn.verify("256709920188");

// Collect money (deposit / request payment)
const deposit = await wallet.transactions.deposit({ ... });

// Send money (withdraw / disburse)
const withdraw = await wallet.transactions.withdraw({ ... });

// Check a transaction's status
const status = await wallet.transactions.getStatus("my-ref-123");

// Poll until SUCCEEDED / FAILED / INDETERMINATE (use callbacks instead in production)
const final = await wallet.transactions.pollUntilComplete("my-ref-123");

// List supported banks (cached)
const banks = await wallet.bankTransfer.getBanks();

// Push money to a bank account
const transfer = await wallet.bankTransfer.requestTransfer({ ... });

// Check bank transfer status
const bankStatus = await wallet.bankTransfer.checkStatus("my-ref-456");
```

---

## API Reference

### `wallet.balance`

#### `check(currency?): Promise<BalanceData>`

Get your current wallet balance. Never cached.

```typescript
const { amount, formatted, currency } = await wallet.balance.check();
// amount:    1834665
// formatted: "1,834,665"
// currency:  "UGX"
```

---

### `wallet.msisdn`

#### `verify(msisdn): Promise<MsisdnData>`

Verify the name registered to a Ugandan mobile money number.
Call this before disbursing funds to confirm the recipient.

```typescript
const info = await wallet.msisdn.verify("256709920188");
// { msisdn: "256709920188", FirstName: "John", Surname: "Doe" }
```

- Phone must be in international format: `256` + 9 digits.
- Throws `SsentezoValidationError` if format is wrong (client-side, no API call made).
- Throws `SsentezoError` if the number cannot be verified on the network.

---

### `wallet.transactions`

#### `deposit(params): Promise<TransactionInitResult>`

Collect money from a customer's mobile money account.
Sends a USSD prompt to their phone — they confirm with their PIN.

```typescript
import { generateReference } from "@/lib/ssentezo";

const result = await wallet.transactions.deposit({
  externalReference: generateReference(),  // unique per transaction
  msisdn:            "256709920188",
  amount:            10_000,               // UGX, no formatting
  reason:            "Order #1234 payment",
  name:              "John Doe",           // optional
  successCallback:   "https://yourapp.com/api/payments/callback",
  failureCallback:   "https://yourapp.com/api/payments/callback",
});

// result.transactionStatus === "PENDING" (always on success)
// result.ssentezoWalletReference  — Ssentezo's UUID
// result.financialTransactionId   — network operator's ID
```

#### `withdraw(params): Promise<TransactionInitResult>`

Same parameters as `deposit`. Sends money **from** your wallet **to** a mobile money number.

```typescript
const result = await wallet.transactions.withdraw({
  externalReference: generateReference(),
  msisdn:            "256709920188",
  amount:            25_000,
  reason:            "Vendor payout",
});
```

#### `getStatus(externalReference): Promise<TransactionStatusResult>`

Check the current status of a transaction.

```typescript
const status = await wallet.transactions.getStatus("order_abc-3a8f...");
// status.transactionStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "INDETERMINATE"
// status.amount, status.msisdn, status.transactionTime, ...
```

> **Prefer callbacks over polling.** Register `successCallback` / `failureCallback`
> when creating the transaction and let Ssentezo notify you.

#### `pollUntilComplete(externalReference, opts?): Promise<TransactionStatusResult | null>`

Polls `getStatus` until a terminal state is reached.
Returns `null` if `maxWaitMs` is exceeded.

```typescript
const result = await wallet.transactions.pollUntilComplete("order_abc-3a8f...", {
  intervalMs: 5_000,    // poll every 5 s  (default)
  maxWaitMs:  120_000,  // give up after 2 min (default)
  onPoll: (s) => console.log("Waiting:", s.transactionStatus),
});

if (result?.transactionStatus === "SUCCEEDED") {
  // fulfilment logic
}
```

**Transaction amount limits:** UGX 500 – 7,000,000.

---

### `wallet.bankTransfer`

#### `getBanks(opts?): Promise<Bank[]>`

Get the list of supported banks. Cached for 1 hour by default.

```typescript
const banks = await wallet.bankTransfer.getBanks();
// [{ id: 3, bank_name: "Equity", address: "...", swift_code: "..." }, ...]

// Force a fresh fetch
const fresh = await wallet.bankTransfer.getBanks({ fresh: true });
```

#### `getBankById(bankId): Promise<Bank | undefined>`

```typescript
const bank = await wallet.bankTransfer.getBankById(4);
// { id: 4, bank_name: "Stanbic Bank", ... }
```

#### `findBanks(query): Promise<Bank[]>`

```typescript
const results = await wallet.bankTransfer.findBanks("equity");
```

#### `requestTransfer(params): Promise<BankTransferInitResult>`

Minimum amount: **UGX 50,000**.

```typescript
const result = await wallet.bankTransfer.requestTransfer({
  externalReference: generateReference(),
  bankId:            4,          // from getBanks()
  accountName:       "John Doe",
  accountNumber:     "044653389534563",
  amount:            75_000,
  reason:            "Supplier payment",
});
```

#### `checkStatus(externalReference): Promise<BankTransferStatusResult>`

```typescript
const status = await wallet.bankTransfer.checkStatus("my-ref");
```

---

## Error Handling

The SDK ships three purpose-built helpers that eliminate repetitive
`if (err instanceof X) ...` chains. Pick the one that fits your context.

### Error class hierarchy

```
SsentezoError                ← base class
├── SsentezoAuthError        ← HTTP 401 / 403
├── SsentezoRateLimitError   ← HTTP 429, retries exhausted
├── SsentezoValidationError  ← HTTP 422 or client-side validation
├── SsentezoNetworkError     ← network failure, retries exhausted
└── SsentezoTimeoutError     ← request exceeded timeout
```

---

### 1. `withSsentezo(fn)` — for Server Actions

Wraps an async Ssentezo call and returns a **discriminated union** — never throws.
The ideal wrapper for `"use server"` functions, where throwing crashes the action.

```typescript
import { withSsentezo, generateReference, type SsentezoActionResult } from "@/lib/ssentezo";

export async function collectPayment(
  msisdn: string,
  amount: number,
): Promise<SsentezoActionResult<{ reference: string }>> {
  return withSsentezo(async () => {
    const ref = generateReference();
    await wallet.transactions.deposit({ externalReference: ref, msisdn, amount, reason: "Payment" });
    return { reference: ref };
  });
}

// In your Client Component:
const result = await collectPayment("256709920188", 5_000);

if (result.success) {
  console.log(result.data.reference);
} else {
  console.error(result.error);        // safe public message, never leaks internals
  console.error(result.kind);         // "validation" | "auth" | "rateLimit" | "timeout" | "network" | "api" | "unknown"
  console.error(result.fieldErrors);  // populated when kind === "validation"
  console.error(result.code);         // populated when kind === "api", e.g. "UPPER_CEILING_BREACH"
}
```

---

### 2. `handleSsentezoRouteError(err, NextResponse)` — for Route Handlers

One-liner that builds and returns a typed `NextResponse` with the correct HTTP
status code. Unknown errors are **re-thrown** so Next.js / Sentry can handle them.

```typescript
import { NextResponse } from "next/server";
import { handleSsentezoRouteError } from "@/lib/ssentezo";

export async function POST(req: NextRequest) {
  try {
    const result = await wallet.transactions.deposit({ ... });
    return NextResponse.json({ status: result.transactionStatus });
  } catch (err) {
    return handleSsentezoRouteError(err, NextResponse); // ← replaces the entire chain
  }
}
```

Error response body shape:
```json
{
  "error": "Amount must be at least UGX 500.",
  "kind": "validation",
  "fieldErrors": { "amount": ["must be at least 500"] }
}
```

---

### 3. `handleSsentezoError(err)` — when you need to branch by kind

Classifies any thrown value into a **typed `SsentezoErrorResult`** discriminated
union so you can take specific action before deciding what to return.

```typescript
import { handleSsentezoError, publicMessage } from "@/lib/ssentezo";

} catch (err) {
  const result = handleSsentezoError(err);

  if (result.kind === "validation") {
    return { userError: result.message, fields: result.fieldErrors };
  }

  if (result.kind === "rateLimit") {
    await scheduleRetryJob(externalRef, { delayMs: 60_000 });
    return { userError: result.publicMessage };
  }

  if (result.kind === "auth") {
    alertOpsTeam("Ssentezo credentials invalid");
    return { userError: result.publicMessage }; // "Service configuration error."
  }

  // For all other kinds, publicMessage() picks the right safe string
  return { userError: publicMessage(result) };
}
```

### `SsentezoErrorResult` kind reference

| `kind`         | Source class              | `httpStatus` | Safe `publicMessage`                              | Extra fields               |
|----------------|---------------------------|:------------:|---------------------------------------------------|----------------------------|
| `"validation"` | `SsentezoValidationError` | 422          | _(use `result.message` — it describes bad input)_ | `fieldErrors`              |
| `"auth"`       | `SsentezoAuthError`       | 401 \| 403   | `"Service configuration error."`                  | —                          |
| `"rateLimit"`  | `SsentezoRateLimitError`  | 429          | `"Too many requests. Please try again shortly."`  | —                          |
| `"timeout"`    | `SsentezoTimeoutError`    | 504          | `"Payment request timed out. Please retry."`      | `timeoutMs`                |
| `"network"`    | `SsentezoNetworkError`    | 503          | `"Could not reach the payment service. Please retry."` | —                     |
| `"api"`        | `SsentezoError`           | varies       | _(use `result.message` — it comes from Ssentezo)_ | `code` (e.g. `"UPPER_CEILING_BREACH"`) |
| `"unknown"`    | anything else             | 500          | `"An unexpected payment error occurred."`         | `cause` (original error)   |

---

## Utility Functions

### `generateReference(): string`

Generate a cryptographically random UUID v4 for use as `externalReference`.

```typescript
import { generateReference } from "@/lib/ssentezo";
const ref = generateReference(); // "3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"
```

### `generatePrefixedReference(prefix): string`

```typescript
const ref = generatePrefixedReference("order_1234");
// "order_1234_3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"
```

### `parseCallbackPayload(body): CallbackData | null`

Safely parse and validate an incoming Ssentezo callback POST body.
Returns `null` on invalid shape — never throws.

```typescript
import { parseCallbackPayload } from "@/lib/ssentezo";

export async function POST(req: NextRequest) {
  const payload = parseCallbackPayload(await req.json());
  if (!payload) return new Response("Bad Request", { status: 400 });

  const { transactionStatus, externalReference } = payload;
  // ...
}
```

### `publicMessage(result): string`

Extract the safest browser-facing message from a `SsentezoErrorResult`.
Used internally by `withSsentezo` and `handleSsentezoRouteError`, but also
available for custom flows.

```typescript
import { handleSsentezoError, publicMessage } from "@/lib/ssentezo";

const result = handleSsentezoError(err);
const msg = publicMessage(result);
// validation → full message   (describes bad user input, safe to show)
// api        → API message    (from Ssentezo, generally safe to show)
// auth       → "Service configuration error."
// rateLimit  → "Too many requests. Please try again shortly."
// timeout    → "Payment request timed out. Please retry."
// network    → "Could not reach the payment service. Please retry."
// unknown    → "An unexpected payment error occurred."
```

---

## Advanced Configuration

```typescript
const wallet = new SsentezoWallet({
  apiUser:       "your_api_user",   // or set SSENTEZO_API_USER
  apiKey:        "your_api_key",    // or set SSENTEZO_API_KEY
  environment:   "sandbox",         // "live" | "sandbox"
  timeout:       15_000,            // 15 s per request (default: 30 s)
  maxRetries:    5,                  // default: 3
  bankCacheTtlMs: 30 * 60 * 1_000,  // 30 min bank list cache (default: 1 hr)
});
```

---

## Next.js Patterns

### Server Component (display balance)

```tsx
// app/dashboard/page.tsx
import { wallet } from "@/lib/payments";

export default async function DashboardPage() {
  const balance = await wallet.balance.check();

  return (
    <div>
      <h1>Wallet Balance</h1>
      <p>UGX {balance.formatted}</p>
    </div>
  );
}
```

### Server Action (collect payment)

```tsx
// app/checkout/actions.ts
"use server";
import { wallet, generateReference } from "@/lib/payments";

export async function startCheckout(formData: FormData) {
  const result = await wallet.transactions.deposit({
    externalReference: generateReference(),
    msisdn:            formData.get("msisdn") as string,
    amount:            Number(formData.get("amount")),
    reason:            "Checkout payment",
    successCallback:   `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
    failureCallback:   `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
  });
  return result;
}
```

### Callback Route Handler (webhook)

```typescript
// app/api/payments/callback/route.ts
import { parseCallbackPayload } from "@/lib/ssentezo";

export async function POST(req: Request) {
  const payload = parseCallbackPayload(await req.json());
  if (!payload) return Response.json({ received: true });

  if (payload.transactionStatus === "SUCCEEDED") {
    // Update your DB with payload.externalReference
  }

  // Always return 200 — Ssentezo does not retry on success
  return Response.json({ received: true });
}
```

---

## Security Checklist

- [ ] `SSENTEZO_API_USER` and `SSENTEZO_API_KEY` are **server-side only** env vars (no `NEXT_PUBLIC_` prefix)
- [ ] Add `import "server-only"` to `lib/payments.ts` to enforce the boundary at build time
- [ ] Callback routes return HTTP 200 even on processing errors (prevents Ssentezo retries)
- [ ] Callback routes do **not** require authentication
- [ ] `externalReference` values are unique per transaction (use `generateReference()`)
- [ ] Validate callback payload shape with `parseCallbackPayload()` before processing
- [ ] Never log or expose raw API credentials in errors or responses
- [ ] Use the sandbox environment (`SSENTEZO_ENV=sandbox`) during development

---

## Amount Limits

| Operation       | Minimum       | Maximum       |
|-----------------|---------------|---------------|
| Mobile Money    | UGX 500       | UGX 7,000,000 |
| Bank Transfer   | UGX 50,000    | UGX 7,000,000 |

---

## Transaction Status Flow

```
             ┌──────────────────┐
   initiate  │                  │
  ─────────► │     PENDING      │
             │                  │
             └──────┬─────┬─────┘
                    │     │
           success  │     │  failure / timeout
                    ▼     ▼
             SUCCEEDED   FAILED
                              ╲
                               INDETERMINATE
                               (resolves within 48 h)
```

---

## Registering for an API Account

- **Live:**    https://wallet.ssentezo.com/merchants/sign-up
- **Sandbox:** https://devwallet.ssentezo.com/merchants/sign-up

API credentials are generated from the **API Access** menu in your merchant dashboard.
