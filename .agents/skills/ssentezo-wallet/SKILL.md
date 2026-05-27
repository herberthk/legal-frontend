---
name: ssentezo-wallet
description:
  A fully-typed TypeScript SDK for the Ssentezo Wallet API — Uganda's mobile money payment platform. Built for Next.js App Router with first-class support for Server Components, Server Actions, and Route Handlers. Works in any Node.js ≥ 18 or Edge Runtime environment. Use this skill whenever you are writing, debugging, or explaining code that uses the **Ssentezo Wallet SDK** (the TypeScript SDK located at `lib/ssentezo/`). This SDK wraps the Ssentezo Wallet REST API for Ugandan mobile money payments inside a Next.js App Router project.
  This skill is the **authoritative reference**. Do not rely on training data or the raw Ssentezo API docs for SDK usage — always use this file.
---

# What this skill covers

Use this skill whenever you are writing, debugging, or explaining code that uses
the **Ssentezo Wallet SDK** (the TypeScript SDK located at `lib/ssentezo/`).
This SDK wraps the Ssentezo Wallet REST API for Ugandan mobile money payments
inside a Next.js App Router project.

This skill is the **authoritative reference**. Do not rely on training data or
the raw Ssentezo API docs for SDK usage — always use this file.

## File map

```
lib/ssentezo/
├── index.ts                      ← Single import surface for the whole SDK
├── types.ts                      ← All TypeScript interfaces
├── errors.ts                     ← Error class hierarchy + type guards
├── error-handler.ts              ← handleSsentezoError / withSsentezo / handleSsentezoRouteError
├── validators.ts                 ← Client-side validation (fires before any fetch)
├── client.ts                     ← HTTP core: auth, retry, timeout, cache:"no-store"
├── utils.ts                      ← generateReference, parseCallbackPayload, sleep
├── resources/
│   ├── balance.ts                ← wallet.balance
│   ├── msisdn.ts                 ← wallet.msisdn
│   ├── transactions.ts           ← wallet.transactions  (deposit / withdraw / getStatus / poll)
│   └── bank-transfer.ts         ← wallet.bankTransfer  (getBanks / requestTransfer / checkStatus)
└── hooks/
    └── useTransactionStatus.ts  ← Client-side React polling hook
```

Everything a consumer needs is re-exported from `index.ts`.
Import path is always `@/lib/ssentezo`.

---

## Instantiation

```typescript
// lib/payments.ts  — shared singleton, import this everywhere
import "server-only";
import { getSsentezoWallet } from "@/lib/ssentezo";
export const wallet = getSsentezoWallet();
```

Credentials are read from:

- `SSENTEZO_API_USER` (env var)
- `SSENTEZO_API_KEY` (env var)
- `SSENTEZO_ENV` (`"live"` | `"sandbox"`, defaults to `"live"`)

`getSsentezoWallet()` reuses a singleton in development (survives HMR) and
creates a fresh instance per cold start in production (no serverless state bleed).

---

## All resource methods

### wallet.balance

```typescript
// Returns: { amount: number; formatted: string; currency: "UGX" }
const balance = await wallet.balance.check();
```

### wallet.msisdn

```typescript
// Returns: { msisdn: string; FirstName: string; Surname: string }
// Throws SsentezoValidationError (client-side) if format is wrong — no HTTP call made
const info = await wallet.msisdn.verify("256709920188");
```

Phone format: `256` + 9 digits, no spaces, no `+`.

### wallet.transactions

```typescript
// Deposit (collect from customer) — returns { transactionStatus: "PENDING", ssentezoWalletReference, financialTransactionId }
await wallet.transactions.deposit({
  externalReference: generateReference(),  // unique per transaction
  msisdn:            "256709920188",
  amount:            5_000,                // UGX integer, 500–7_000_000
  reason:            "Order #1234",
  name:              "John Doe",           // optional
  successCallback:   "https://yourapp.com/api/payments/callback",
  failureCallback:   "https://yourapp.com/api/payments/callback",
});

// Withdraw (send to recipient) — same params as deposit
await wallet.transactions.withdraw({ ... });

// Status check
const status = await wallet.transactions.getStatus("my-ref");
// status.transactionStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "INDETERMINATE"

// Polling (use callbacks in production instead)
const final = await wallet.transactions.pollUntilComplete("my-ref", {
  intervalMs: 5_000,   // default
  maxWaitMs:  120_000, // default, returns null if exceeded
  onPoll: (s) => console.log(s.transactionStatus),
});
```

### wallet.bankTransfer

```typescript
// Get bank list (cached 1 hr by default)
const banks = await wallet.bankTransfer.getBanks();
const bank = await wallet.bankTransfer.getBankById(4);
const found = await wallet.bankTransfer.findBanks("stanbic");
wallet.bankTransfer.clearBankCache(); // force next call to re-fetch

// Transfer (minimum UGX 50,000)
await wallet.bankTransfer.requestTransfer({
  externalReference: generateReference(),
  bankId: 4,
  accountName: "John Doe",
  accountNumber: "044653389534563",
  amount: 75_000,
  reason: "Supplier payment",
});

// Status
await wallet.bankTransfer.checkStatus("my-ref");
```

---

## Amount limits

| Operation     | Minimum    | Maximum       |
| ------------- | ---------- | ------------- |
| Mobile money  | UGX 500    | UGX 7,000,000 |
| Bank transfer | UGX 50,000 | UGX 7,000,000 |

Amounts must be whole integers. Never pass formatted strings like `"1,000"`.

---

## Error handling — ALWAYS use the helpers, never write manual if/instanceof chains

### ❌ Old pattern (never write this)

```typescript
} catch (err) {
  if (isSsentezoValidationError(err)) { return { error: err.message }; }
  if (err instanceof SsentezoAuthError) { ... }
  if (err instanceof SsentezoRateLimitError) { ... }
  if (err instanceof SsentezoTimeoutError) { ... }
  if (err instanceof SsentezoNetworkError) { ... }
  if (err instanceof SsentezoError) { ... }
  throw err;
}
```

### ✅ Server Actions — use `withSsentezo()`

Wraps the entire async call. Returns `{ success: true, data }` or
`{ success: false, error, kind, fieldErrors, code }`. Never throws.

```typescript
"use server";
import {
  withSsentezo,
  generateReference,
  type SsentezoActionResult,
} from "@/lib/ssentezo";

export async function collectPayment(
  msisdn: string,
  amount: number,
): Promise<SsentezoActionResult<{ reference: string }>> {
  return withSsentezo(async () => {
    const ref = generateReference();
    await wallet.transactions.deposit({
      externalReference: ref,
      msisdn,
      amount,
      reason: "Payment",
    });
    return { reference: ref };
  });
}

// Client component usage:
const result = await collectPayment("256709920188", 5_000);
if (result.success) {
  console.log(result.data.reference);
} else {
  console.error(result.error); // safe public message
  console.error(result.fieldErrors); // field-level map, populated for "validation" kind
  console.error(result.kind); // "validation" | "auth" | "rateLimit" | "timeout" | "network" | "api" | "unknown"
  console.error(result.code); // API error code e.g. "UPPER_CEILING_BREACH", populated for "api" kind
}
```

### ✅ Route Handlers — use `handleSsentezoRouteError()`

One-liner that returns a `NextResponse` with the right status code and body.
Re-throws unknown errors so Next.js / Sentry can catch them.

```typescript
import { NextResponse } from "next/server";
import { handleSsentezoRouteError } from "@/lib/ssentezo";

} catch (err) {
  return handleSsentezoRouteError(err, NextResponse);
}
```

Response body shape on error:

```json
{ "error": "<public message>", "kind": "<kind>", "fieldErrors"?: {}, "code"?: "UPPER_CEILING_BREACH" }
```

### ✅ Inspect the classified result manually — use `handleSsentezoError()`

When you need to branch on specific error kinds before deciding what to return:

```typescript
import { handleSsentezoError, publicMessage } from "@/lib/ssentezo";

} catch (err) {
  const result = handleSsentezoError(err);

  if (result.kind === "validation") {
    // result.fieldErrors is typed and available here
    return { userError: result.message, fields: result.fieldErrors };
  }

  if (result.kind === "rateLimit") {
    // add Retry-After header, queue job, etc.
    scheduleRetry(externalRef);
    return { userError: result.publicMessage };
  }

  // For all other cases, publicMessage() extracts the right string
  return { userError: publicMessage(result) };
}
```

### Error kind reference

| `kind`         | Source class              | `httpStatus` | Has `publicMessage` | Notes                                |
| -------------- | ------------------------- | ------------ | ------------------- | ------------------------------------ |
| `"validation"` | `SsentezoValidationError` | 422          | —                   | `fieldErrors` map available          |
| `"auth"`       | `SsentezoAuthError`       | 401 \| 403   | ✅                  | Log real message server-side only    |
| `"rateLimit"`  | `SsentezoRateLimitError`  | 429          | ✅                  | All retries exhausted                |
| `"timeout"`    | `SsentezoTimeoutError`    | 504          | ✅                  | `timeoutMs` available                |
| `"network"`    | `SsentezoNetworkError`    | 503          | ✅                  | All retries exhausted                |
| `"api"`        | `SsentezoError`           | varies       | —                   | `code` e.g. `"UPPER_CEILING_BREACH"` |
| `"unknown"`    | anything else             | 500          | —                   | Re-throw in route handlers           |

---

## Utility functions

```typescript
import {
  generateReference,
  generatePrefixedReference,
  parseCallbackPayload,
} from "@/lib/ssentezo";

// UUID v4 — use as externalReference
const ref = generateReference();
// "3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"

// Prefixed for traceability
const ref = generatePrefixedReference("order_1234");
// "order_1234_3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"

// Safe webhook body parser — returns typed object or null, never throws
const payload = parseCallbackPayload(await req.json());
if (!payload) return NextResponse.json({ received: true });
// payload.transactionStatus: "SUCCEEDED" | "FAILED"
// payload.externalReference, payload.ssentezoWalletReference, payload.financialTransactionId
```

---

## React hook — `useTransactionStatus`

**Client components only.** Polls your own Next.js API route for status updates.

```typescript
"use client";
import { useTransactionStatus } from "@/lib/ssentezo/hooks/useTransactionStatus";

const { pollingState, transactionStatus, startPolling, stopPolling, reset } =
  useTransactionStatus({
    endpoint: "/api/payments/status/{reference}", // {reference} is replaced automatically
    intervalMs: 5_000,
    maxWaitMs: 120_000,
    onTerminal: (status) => {
      if (status === "SUCCEEDED") router.push("/success");
    },
  });

// Start polling when you get a reference
useEffect(() => {
  if (ref) startPolling(ref);
}, [ref]);
```

`pollingState` values: `"idle"` | `"polling"` | `"succeeded"` | `"failed"` | `"indeterminate"` | `"timeout"` | `"error"`

The hook polls immediately on `startPolling()` then on `intervalMs` intervals.
It cleans up its own `setInterval` on unmount.

---

## Callback (webhook) route

```typescript
// app/api/payments/callback/route.ts
// ⚠️ Must be: public (no auth), respond < 5 s, always return HTTP 200
import { parseCallbackPayload } from "@/lib/ssentezo";

export async function POST(req: Request) {
  const payload = parseCallbackPayload(await req.json().catch(() => null));
  if (!payload) return Response.json({ received: true });

  if (payload.transactionStatus === "SUCCEEDED") {
    // update DB using payload.externalReference
  }

  return Response.json({ received: true }); // always 200
}
```

---

## `externalReference` rules

- Must be **unique** across all transactions in your account
- Max 250 characters
- Use `generateReference()` or `generatePrefixedReference()` — never reuse
- Ties your internal order/payout to the Ssentezo transaction
- Used in `getStatus()`, `pollUntilComplete()`, and `bankTransfer.checkStatus()`

---

## Security rules (never violate these)

1. `import "server-only"` on `lib/payments.ts` — hard build error if the SDK
   leaks into a client bundle.
2. `SSENTEZO_API_USER` / `SSENTEZO_API_KEY` must never have `NEXT_PUBLIC_` prefix.
3. Auth errors (`kind === "auth"`) must only log the real message server-side;
   return `result.publicMessage` to the browser.
4. Callback endpoints must not require authentication and must always return 200.
5. `cache: "no-store"` is already set on every fetch inside `client.ts` — do not
   add Next.js `revalidate` or `cache` options to route handlers that call the SDK.
6. Never expose `externalReference` values from other users to the requesting user.

---

## Common mistakes and fixes

| Mistake                                                | Fix                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Writing manual `instanceof` chains in catch blocks     | Use `withSsentezo()` (actions) or `handleSsentezoRouteError()` (routes)         |
| Treating HTTP 202 + `PENDING` as failure               | `PENDING` is the **normal** initial status — it means the request was accepted  |
| Reusing `externalReference` on retry                   | Call `generateReference()` to get a fresh UUID each time                        |
| Importing the wallet in a Client Component             | Add `import "server-only"` to `lib/payments.ts`; the build will catch it        |
| Passing a formatted amount string `"1,000"`            | Pass the raw integer `1000`                                                     |
| Polling in a tight loop                                | Use callbacks; if you must poll, `pollUntilComplete` has built-in 5 s intervals |
| Forgetting `encodeURIComponent` in status path         | `getStatus()` already does this — do not encode the ref before passing it       |
| Callback endpoint requiring auth                       | Ssentezo cannot authenticate; the route must be open                            |
| Throwing from a callback endpoint                      | Always return 200 even on DB errors; fix with a background reconciliation job   |
| Checking `result.kind === "unknown"` and swallowing it | Re-throw unknown errors in route handlers so Next.js / Sentry receives them     |

---

## TypeScript types (quick reference)

```typescript
// All importable from "@/lib/ssentezo"
SsentezoConfig; // constructor options
SsentezoActionResult<T>; // return type of withSsentezo() and Server Actions
SsentezoErrorResult; // discriminated union from handleSsentezoError()
TransactionStatus; // "PENDING" | "SUCCEEDED" | "FAILED" | "INDETERMINATE"
TransactionParams; // deposit / withdraw params
TransactionInitResult; // { transactionStatus, ssentezoWalletReference, financialTransactionId }
TransactionStatusResult; // full status response
BankTransferParams; // requestTransfer params
BankTransferInitResult; // { transactionStatus, ssentezoWalletReference, externalReference }
BankTransferStatusResult;
BalanceData; // { amount, formatted, currency }
MsisdnData; // { msisdn, FirstName, Surname }
Bank; // { id, bank_name, address, swift_code }
CallbackPayload; // webhook body shape
```
