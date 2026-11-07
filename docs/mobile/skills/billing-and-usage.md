<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:55119a58159e9606ba8a4bb374c93d4e332bd9cd3c2397a3b5b64ee5f9a9af1d -->

# Billing & Usage — Mobile Agent Skill

> How credit works, how to pre-flight a spend, and how to read usage/wallet
> history. Balances are stored in **US cents**; the UI shows **UGX**. Every AI
> feature deducts through the same metered path, so the same 402 handling applies
> everywhere.

## What this covers

- The credit model (welcome bonus → daily free tokens → paid balance) and the rates.
- `GET /billing/can-send` — pre-flight before an AI action.
- `GET /usage`, `GET /usage/chart`, `GET /usage/free-credits`.
- `GET /transactions`, `GET /transactions/:id`.
- Converting cents ↔ UGX for display.

## The credit model

Every AI call estimates its cost up front and rejects with **402** if the estimate
exceeds available credit. On success it deducts in a fixed order:

1. **Welcome bonus** (`welcomeTextTokens`, `freeVoiceSeconds`) — one-time for new users.
2. **Daily free tokens** (`freeTextTokens`) — replenished on `nextDailyReset`.
3. **Paid balance** (`balance`, in **US cents**).

Rates (server constants — mirror them client-side only for display/estimates):

| Constant                   | Value                           |
| -------------------------- | ------------------------------- |
| Text                       | `$0.027` / 1,000 tokens         |
| Voice                      | `$0.08` / minute (`$0.00133`/s) |
| Welcome free text          | 4,000 tokens                    |
| Welcome free voice         | 120 s                           |
| Daily free text            | 1,000 tokens / 5 days           |
| Max voice session          | 1,800 s (30 min)                |
| Mobile-money fee           | 3%                              |
| USD → UGX                  | `× 3800`                        |
| Chars per token (estimate) | 4                               |

## Pre-flight — `GET /billing/can-send`

Cheap gate to disable the composer / show a paywall _before_ the user invests
effort in a prompt or upload:

```
GET /billing/can-send
→ 200 { "data": { "canSend": true,  "reason": null } }
→ 200 { "data": { "canSend": false, "reason": "Insufficient funds or free tokens. Please add funds to continue." } }
```

Always HTTP 200 — inspect `data.canSend`. This is advisory; the AI routes still
enforce credit authoritatively and can return 402 even after a `canSend: true`
(balance can change between calls).

```ts
const { canSend, reason } = await apiFetch<{
  canSend: boolean;
  reason: string | null;
}>("/billing/can-send");
if (!canSend) showPaywall(reason);
```

## Usage summary — `GET /usage`

```
GET /usage?filter=today|yesterday|last_week|month|custom&start=<ISO>&end=<ISO>
→ 200 { "data": {
    "success": true,
    "records": UsageRecord[],   // most recent 20 in range
    "totalTokens": 12345,
    "totalCost": 333,           // CENTS ($3.33)
    "totalSeconds": 480         // voice seconds
} }
```

Sample JSON response:

```jsonc
// 200 GET /usage
{
  "data": {
    "success": true,
    "totalTokens": 1420,
    "totalCost": 38, // 38 US CENTS ($0.38)
    "totalSeconds": 90,
    "records": [
      {
        "id": "usage_rec_001",
        "userId": "usr_abc",
        "type": "TEXT_RESPONSE",
        "tokens": 1420,
        "cost": 38, // US CENTS
        "seconds": 0,
        "source": "paid", // "free" | "paid" | "welcome"
        "sessionId": "chat_session_123",
        "createdAt": "2026-10-21T09:12:00.000Z",
      },
    ],
  },
}
```

```ts
type UsageSource = "free" | "paid" | "welcome";
type UsageType = "TEXT_RESPONSE" | "VOICE_SESSION" | "DOCUMENT_TRANSCRIPTION";
type UsageFilter = "today" | "yesterday" | "last_week" | "month" | "custom";

interface UsageRecord {
  id: string;
  userId: string;
  type: UsageType;
  tokens: number;
  cost: number; // in US CENTS
  seconds: number;
  source: UsageSource;
  sessionId: string;
  createdAt: string; // ISO string
}
```

- `filter` defaults to `today`. For `custom`, pass `start` and `end` as ISO dates.
- `totalCost` is **cents** — convert for display.

## Usage chart — `GET /usage/chart`

Pre-aggregated series for a bar/line chart:

```
GET /usage/chart?filter=last_week&start=<ISO>&end=<ISO>&timezoneOffset=-180
→ 200 { "data": {
    "success": true,
    "chartData": ChartDataPoint[],
    "totalPeriodCost": 840      // CENTS ($8.40)
} }
```

Sample JSON response:

```jsonc
// 200 GET /usage/chart
{
  "data": {
    "success": true,
    "totalPeriodCost": 840, // 840 US CENTS ($8.40)
    "chartData": [
      {
        "name": "Mon",
        "text": 900, // tokens
        "voice": 60, // seconds
        "document": 2, // page count
        "cost": 120, // US CENTS
      },
      {
        "name": "Tue",
        "text": 1450, // Tokens
        "voice": 120, // Seconds
        "document": 0, // Page Count
        "cost": 210, // US CENTS ($2.10)
      },
    ],
  },
}
```

```ts
interface ChartDataPoint {
  name: string; // Day label ("Mon") or hour label ("14:00")
  text: number; // token count
  voice: number; // voice seconds
  document: number; // document pages/count
  cost: number; // in US CENTS
}
```

- `filter` defaults to `last_week`. `today`/`yesterday` bucket **hourly**; others
  bucket by day.
- **`timezoneOffset`** is `new Date().getTimezoneOffset()` (minutes) so buckets
  align to the device's local day. Pass it or charts will be off by the UTC offset.
- `getUsageChartData` returns `voice` in **seconds** and `document` as a **token count**.
- `cost` per bucket and `totalPeriodCost` are **US cents** (stored cents divided
  by 100). For UGX display, multiply these chart values by USD_UGX_RATE provided directly.

```ts
const q = new URLSearchParams({
  filter: "last_week",
  timezoneOffset: String(new Date().getTimezoneOffset()),
});
const { chartData, totalPeriodCost } = await apiFetch<{
  chartData: ChartDataPoint[];
  totalPeriodCost: number;
}>(`/usage/chart?${q}`);
```

## Free-credit history — `GET /usage/free-credits`

Page-based ledger of free-credit grants/resets:

```
GET /usage/free-credits?page=1&pageSize=20        # page ≥1 (default 1), pageSize ≤ 50 (default 10)
→ 200 { "data": { "success": true, "records": FreeCreditHistory[], "totalCount": 42, "totalPages": 3 } }
```

Sample JSON response:

```jsonc
// 200 GET /usage/free-credits
{
  "data": {
    "success": true,
    "totalCount": 2,
    "totalPages": 1,
    "records": [
      {
        "id": "cred_002",
        "userId": "usr_abc",
        "amount": 1000,
        "type": "RENEWAL", // "RENEWAL" | "WELCOME"
        "createdAt": "2026-10-21T00:00:00.000Z",
      },
      {
        "id": "cred_001",
        "userId": "usr_abc",
        "amount": 4000,
        "type": "WELCOME",
        "createdAt": "2026-10-15T12:00:00.000Z",
      },
    ],
  },
}
```

```ts
interface FreeCreditHistory {
  id: string;
  userId: string;
  amount: number; // tokens awarded
  type: "RENEWAL" | "WELCOME";
  createdAt: string; // ISO string
}
```

## Wallet history — `GET /transactions`

```
GET /transactions?page=1&pageSize=20&type=ALL&duration=all
→ 200 { "data": { "success": true, "transactions": Transaction[], "totalCount": 87, "totalPages": 5 } }

GET /transactions/:id
→ 200 { "data": { "success": true, "transaction": Transaction } }
→ 404 NOT_FOUND        # missing OR not owned
```

Sample JSON response:

```jsonc
// 200 GET /transactions
{
  "data": {
    "success": true,
    "totalCount": 1,
    "totalPages": 1,
    "transactions": [
      {
        "id": "tx_stripe_999",
        "userId": "usr_abc",
        "type": "DEPOSIT", // "TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT"
        "description": "Wallet Top-up ($10.00)",
        "amount": 1000, // US CENTS ($10.00)
        "details": "Card deposit approved",
        "status": "COMPLETED", // "PENDING" | "COMPLETED" | "FAILED"
        "method": "STRIPE", // "STRIPE" | "AIRTEL" | "MTN"
        "reference": "TX-1729500000000",
        "providerTransactionId": "pi_3Qexample",
        "country": "UG",
        "fee": 0, // in US CENTS
        "createdAt": "2026-10-21T08:00:00.000Z",
      },
    ],
  },
}
```

```ts
type TransactionMethod = "STRIPE" | "AIRTEL" | "MTN";

interface Transaction {
  id: string;
  userId: string;
  type: "TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT";
  description: string;
  amount: number; // in US CENTS
  details: string; // e.g. "1.5k tokens" or "4m 20s"
  status: "PENDING" | "COMPLETED" | "FAILED";
  method: TransactionMethod;
  reference: string;
  providerTransactionId?: string;
  country?: string;
  fee?: number; // in US CENTS
  createdAt: string; // ISO string
}
```

- **Defaults:** `page=1`, `pageSize=10` (max 50 — a larger value is clamped, not
  rejected), `type=ALL`, `duration=all`. Pass `pageSize` explicitly if you want
  more than 10 rows per page; the default is easy to mistake for "no more data."
- `duration` is a **closed 5-value enum** — anything outside it falls back to `all`:

  ```
  all   today   yesterday   last_week   month
  ```

  Note there is **no `custom`** here (unlike `/usage`), so a date-range picker has
  no server support on this route — filter client-side if you need one.

- `type` is forwarded to the query **verbatim and unvalidated**; an unrecognised
  value simply matches nothing and yields an empty page rather than a 400.
- `/transactions/:id` is owner-guarded — a foreign/unknown id is **404** (not 403).

## Cents ↔ UGX conversion

```ts
const USD_TO_UGX = 3800;

// cents → UGX (for display)
const centsToUgx = (cents: number) => Math.round((cents / 100) * USD_TO_UGX);
// UGX → cents (when initiating a top-up amount)
const ugxToCents = (ugx: number) => Math.round((ugx / USD_TO_UGX) * 100);

// e.g. balance in the User doc:
const ugx = centsToUgx(me.balance); // show `UGX {ugx.toLocaleString()}`
```

Keep this single conversion helper; never scatter the `3800`/`100` literals.

## Best practices

- **Pre-flight big actions** (`/billing/can-send`) but still handle 402 on the AI
  call — the pre-flight can go stale.
- **Refetch `/me` after any spend or top-up** to refresh the balance (there's no
  server push over HTTP). See `account-and-history.md`.
- **Use cents for wallet money math**; chart costs arrive in cents. Convert
  to UGX only at render using the appropriate source unit.
- **Show the three buckets** (welcome / daily free / paid) from the `User` doc so
  users understand why a call was free.

## Gotchas

- Wallet amounts and `/usage` costs are **US cents**; `/usage/chart` costs are
  **US dollars**. A "$3.33" spend is `333` in `usage.totalCost` and `3.33` in
  `chart.cost`.
- `duration` (transactions) and `filter` (usage) are **different** query vocab and
  have **different defaults**:

  | Route           | Param      | Values                                           | Default         |
  | --------------- | ---------- | ------------------------------------------------ | --------------- |
  | `/transactions` | `duration` | `all` `today` `yesterday` `last_week` `month`    | `all`           |
  | `/usage`        | `filter`   | `today` `yesterday` `last_week` `month` `custom` | **`today`**     |
  | `/usage/chart`  | `filter`   | same as `/usage`                                 | **`last_week`** |

  So `/usage` and `/usage/chart` share a vocabulary but **not** a default — calling
  both with no `filter` gives you today's totals beside a week-long chart. Always
  pass `filter` explicitly when the two are shown together.

- Only `/usage` and `/usage/chart` accept `custom` + `start`/`end`, and only when
  **all three** are present (`filter === "custom" && start && end`); a `custom` with
  a missing bound silently falls back to the default window rather than erroring.
- A `canSend: true` is not a guarantee — the authoritative check is on the AI route,
  which can still 402.

<!-- /coderabbit-ai-generated:v1 -->
