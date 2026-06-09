# pawapay-sdk

A comprehensive, production-grade TypeScript SDK for the [pawaPay Merchant API v2](https://docs.pawapay.io/). Full coverage of deposits, payouts, refunds, remittances, toolkit, finances, and hosted Payment Page.

---

## Features

- **Full API coverage** — Deposits · Payouts (single + bulk) · Refunds · Remittances · Toolkit · Finances · Payment Page
- **Zero dependencies** — uses native `fetch`, `crypto`, and `AbortController`
- **Type-safe** — every request and response is fully typed from the OpenAPI spec
- **Retry with jitter** — automatic exponential backoff on 5xx / network errors
- **Client-side validation** — catches bad amounts, phone numbers, UUIDs, and metadata _before_ the network round-trip
- **Fee calculator** — `calculateFee()` computes the PawaPay platform fee before you initiate a transaction
- **Polling helper** — `pollUntilFinal()` waits for async transactions to complete
- **Webhook helpers** — `Content-Digest` verification and typed callback parsers
- **Works everywhere** — Node ≥ 18, Bun, Deno, Cloudflare Workers, Next.js edge runtime

---

## Installation

```bash
npm install pawapay-sdk
# or
yarn add pawapay-sdk
# or
bun add pawapay-sdk
```

---

## Quick Start

```ts
import { PawaPayClient, TransactionStatus } from "pawapay-sdk";

const pawapay = new PawaPayClient({
  apiToken: process.env.PAWAPAY_API_TOKEN!,
  environment: "sandbox", // 'production' for live
});

// 1. Collect from a customer (deposit)
const depositId = pawapay.deposits.generateId(); // UUIDv4
// ⚠️  Persist depositId to your DB BEFORE calling initiate()

const deposit = await pawapay.deposits.initiate({
  depositId,
  payer: {
    type: "MMO",
    accountDetails: {
      phoneNumber: "256700123456", // digits-only, with country code
      provider: "MTN_MOMO_UGA",
    },
  },
  amount: "5000",
  currency: "UGX",
  customerMessage: "LegalAdviser",
  metadata: [{ orderId: "ORD-001" }],
});

if (deposit.status === TransactionStatus.ACCEPTED) {
  console.log("Deposit accepted — waiting for callback or polling...");
}
```

---

## Configuration

```ts
const pawapay = new PawaPayClient({
  apiToken: "your-bearer-token",

  // 'sandbox' (default) | 'production'
  environment: "production",

  // Override base URL (useful in tests)
  baseUrl: "https://my-mock-server.local",

  // Request timeout in ms (default: 30_000)
  timeout: 20_000,

  // Max retries on 5xx / network error (default: 3)
  maxRetries: 3,

  // Base delay for exponential backoff in ms (default: 500)
  retryDelay: 500,

  // Merged into every request
  extraHeaders: { "X-App-Version": "2.1.0" },

  // Custom fetch (e.g. node-fetch in older environments)
  fetchImpl: customFetch,
});
```

---

## Deposits

```ts
// Initiate
const depositId = pawapay.deposits.generateId();
const result = await pawapay.deposits.initiate({
  depositId,
  payer,
  amount,
  currency,
});

// Check status
const status = await pawapay.deposits.checkStatus(depositId);

// Resend callback (for reconciliation)
await pawapay.deposits.resendCallback(depositId);
```

---

## Payouts

```ts
// Single payout
const payoutId = pawapay.payouts.generateId();
const payout = await pawapay.payouts.initiate({
  payoutId,
  recipient: {
    type: "MMO",
    accountDetails: { phoneNumber: "256700123456", provider: "MTN_MOMO_UGA" },
  },
  amount: "10000",
  currency: "UGX",
});

// Bulk payouts (up to 100)
const bulk = await pawapay.payouts.initiateBulk({
  payouts: [
    {
      payoutId: pawapay.payouts.generateId(),
      recipient,
      amount: "1000",
      currency: "UGX",
    },
    {
      payoutId: pawapay.payouts.generateId(),
      recipient,
      amount: "2000",
      currency: "UGX",
    },
  ],
});

// Cancel enqueued payout
await pawapay.payouts.cancelEnqueued(payoutId);

// Check status / resend callback
const status = await pawapay.payouts.checkStatus(payoutId);
await pawapay.payouts.resendCallback(payoutId);
```

---

## Refunds

```ts
const refundId = pawapay.refunds.generateId();
const refund = await pawapay.refunds.initiate({
  refundId,
  depositId: "original-deposit-uuid",
  amount: "5000",
  currency: "UGX",
});

const status = await pawapay.refunds.checkStatus(refundId);
```

---

## Remittances

```ts
const remittanceId = pawapay.remittances.generateId();
const remittance = await pawapay.remittances.initiate({
  remittanceId,
  recipient: {
    type: "MMO",
    accountDetails: { phoneNumber: "256700123456", provider: "MTN_MOMO_UGA" },
  },
  amount: "50000",
  currency: "UGX",
});
```

---

## Toolkit

```ts
// Predict provider and sanitise phone number
const { provider, phoneNumber, country } =
  await pawapay.toolkit.predictProvider({
    phoneNumber: "+256 700-123456",
  });
// provider: 'MTN_MOMO_UGA', phoneNumber: '256700123456'

// Get your full account configuration (limits, currencies, auth types)
const config = await pawapay.toolkit.getActiveConfiguration();
const ugaProviders =
  config.countries.find((c) => c.country === "UGA")?.providers ?? [];

// Filter by country + operation type
const ugaDeposits = await pawapay.toolkit.getActiveConfiguration({
  country: "UGA",
  operationType: OperationType.DEPOSIT,
});

// Real-time provider availability
const availability = await pawapay.toolkit.getProviderAvailability();

// Public keys for verifying signed callbacks
const keys = await pawapay.toolkit.getPublicKeys();
```

---

## Finances

```ts
// Wallet balances
const { balances } = await pawapay.finances.getWalletBalances();
balances.forEach((b) =>
  console.log(`${b.provider}: ${b.balance} ${b.currency}`),
);

// Request a statement
const statementId = generateUUID();
await pawapay.finances.initiateStatement({
  statementId,
  fromDateTime: "2024-01-01T00:00:00Z",
  toDateTime: "2024-01-31T23:59:59Z",
});

// Check statement + get download URL
const stmt = await pawapay.finances.checkStatementStatus(statementId);
if (stmt.status === "COMPLETED") console.log("Download:", stmt.url);
```

---

## Hosted Payment Page

```ts
const depositId = pawapay.paymentPage.generateId();
const { redirectUrl } = await pawapay.paymentPage.createDeposit({
  depositId,
  amount: "5000",
  currency: "UGX",
  returnUrl: "https://yourapp.com/payment/complete",
});
// Redirect user to redirectUrl
```

---

## Polling for async results

pawaPay is async — `ACCEPTED` means the request was queued, not completed.
Use `pollUntilFinal` when you don't have webhook callbacks configured.

```ts
import {
  PawaPayClient,
  pollUntilFinal,
  pollUntilFinalOrThrow,
} from "pawapay-sdk";

// Option A: non-throwing
const { response, resolved } = await pollUntilFinal(
  () => pawapay.deposits.checkStatus(depositId),
  { maxAttempts: 20, intervalMs: 3_000 },
);
console.log(resolved ? response.finalStatus : "Timed out");

// Option B: throws if no final state reached
const final = await pollUntilFinalOrThrow(
  () => pawapay.deposits.checkStatus(depositId),
  {
    maxAttempts: 30,
    intervalMs: 5_000,
    onAttempt: (n) => console.log(`Attempt ${n}`),
  },
);
console.log(final.finalStatus); // 'COMPLETED' | 'FAILED'
```

---

## Webhook / Callback handling

```ts
import {
  parseDepositCallback,
  verifyContentDigest,
  hasSignatureHeaders,
} from "pawapay-sdk";

// In your Next.js / Express route handler:
app.post("/callbacks/deposit", async (req, res) => {
  const rawBody = req.rawBody; // string — get BEFORE json() parsing

  // 1. Optional: verify Content-Digest header
  const digestValid = await verifyContentDigest(
    rawBody,
    (req.headers["content-digest"] as string) ?? "",
  );
  if (!digestValid) return res.status(400).send("Bad digest");

  // 2. Parse typed callback
  const callback = parseDepositCallback(req.body);
  console.log(callback.depositId, callback.status, callback.finalStatus);

  res.sendStatus(200); // Always respond 200 quickly
});
```

---

## Error handling

```ts
import {
  PawaPayApiError,
  PawaPayNetworkError,
  PawaPayValidationError,
  FailureCode,
} from "pawapay-sdk";

try {
  await pawapay.deposits.initiate(request);
} catch (err) {
  if (err instanceof PawaPayValidationError) {
    // Client-side validation failed — no network call was made
    console.error("Bad request:", err.message, "field:", err.field);
  } else if (err instanceof PawaPayApiError) {
    // API returned a structured error
    console.error("API error:", err.failureCode, err.failureMessage);

    if (err.failureCode === FailureCode.PROVIDER_TEMPORARILY_UNAVAILABLE) {
      // Schedule a retry later
    }
    if (err.isAuthError) {
      // Token invalid / expired
    }
  } else if (err instanceof PawaPayNetworkError) {
    // Timeout, DNS failure, etc.
    console.error("Network error:", err.message);
  }
}
```

## Fee Calculator

PawaPay charges a **3% platform fee** on all Uganda (UGX) transactions. Use `calculateFee` to show customers the exact fee and total _before_ initiating a transaction.

```ts
import { calculateFee, netAmount } from "pawapay-sdk";

// ── Standalone functions ────────────────────────────────────────────────────
const result = calculateFee(150_000, "UGA");

console.log(result.amount); // 150000  (original)
console.log(result.fee); // 4500    (3% platform fee)
console.log(result.total); // 154500  (amount + fee)
console.log(result.currency); // "UGX"
console.log(result.formatted); // "UGX 150,000 + UGX 4,500 fee (3%) = UGX 154,500 total"

// Net amount the merchant receives after PawaPay deducts its fee
const net = netAmount(150_000, "UGA"); // 145_500

// ── Via the client (same result) ───────────────────────────────────────────
const pawapay = new PawaPayClient({ apiToken: "..." });

const fee = pawapay.calculateFee(150_000, "UGA");
const net2 = pawapay.netAmount(150_000, "UGA");
```

### Fee schedule

| Country        | Currency | Rate | Fixed fee | Min | Max |
| -------------- | -------- | ---- | --------- | --- | --- |
| Uganda (`UGA`) | UGX      | 3%   | —         | —   | —   |

> **Note:** More countries will be added as PawaPay expands coverage.

### FeeResult type

```ts
interface FeeResult {
  amount: number; // Original transaction amount
  fee: number; // Platform fee charged by PawaPay
  total: number; // amount + fee (what the customer pays)
  currency: string; // ISO 4217 currency code (e.g. "UGX")
  country: FeeCountry; // Country the schedule applies to
  percentageRate: number; // Percentage applied (e.g. 3)
  fixedFee: number; // Fixed component (0 for Uganda)
  formatted: string; // Human-readable summary
}
```

---

## Utility helpers

```ts
import {
  generateUUID,
  formatAmount,
  sanitisePhoneNumber,
  validatePhoneNumber,
} from "pawapay-sdk";

const id = generateUUID(); // UUIDv4
const amount = formatAmount(5000, 0); // '5000'
const amount2 = formatAmount(49.9, 2); // '49.9'
const phone = sanitisePhoneNumber("+256 700 123-456"); // '256700123456'
validatePhoneNumber(phone); // throws PawaPayValidationError if invalid
```

---

## Environment variables (recommended)

```env
PAWAPAY_API_TOKEN=your_bearer_token_here
PAWAPAY_ENVIRONMENT=production   # or sandbox
```

```ts
const pawapay = new PawaPayClient({
  apiToken: process.env.PAWAPAY_API_TOKEN!,
  environment:
    (process.env.PAWAPAY_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
});
```

---

## Architecture

```
src/
├── index.ts              ← barrel export (single import surface)
├── client.ts             ← PawaPayClient (lazy resource initialisation + fee helpers)
├── http-client.ts        ← HttpClient (fetch, auth, retry, timeout)
├── types/
│   └── index.ts          ← all request/response types + enums
│   └── payment-page.ts
└── utils/
    ├── index.ts          ← UUID, amount, phone, retry helpers
    ├── fees.ts           ← calculateFee / netAmount (country fee schedules)
    ├── polling.ts        ← pollUntilFinal / pollUntilFinalOrThrow
    └── webhooks.ts       ← Content-Digest verification, callback parsers
```

---

## License

MIT
