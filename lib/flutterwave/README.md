# flw-ug-sdk

**Flutterwave v4 Uganda Payment SDK** — TypeScript, isomorphic (Node 18+ / Bun / browser).

Supports **MTN Mobile Money**, **Airtel Money**, **Card** (Visa/Mastercard/Verve/Afrigo), and **Bank/USSD** collection via the v4 Orchestrator Flow. Fees are added on top of the requested amount so the customer bears all transaction costs.

---

## Installation

```bash
# npm
npm install flw-ug-sdk

# Bun
bun add flw-ug-sdk
```

---

## Setup

```ts
import { FlwUganda } from "flw-ug-sdk";

const flw = new FlwUganda({
  clientId:      process.env.FLW_CLIENT_ID!,      // From Flutterwave dashboard → API Settings
  clientSecret:  process.env.FLW_CLIENT_SECRET!,  // From Flutterwave dashboard → API Settings
  encryptionKey: process.env.FLW_ENCRYPTION_KEY!, // Required only for card payments
  environment:   "sandbox",   // → "production" when going live
  timeoutMs:     30_000,      // Optional, default 30 s

  // Both optional — use only if you need per-transaction URL overrides.
  // In most cases, set these once in the Flutterwave dashboard instead.
  callbackUrl:  "https://yourapp.ug/api/payments/callback",
  redirectUrl:  "https://yourapp.ug/payment/complete",
});
```

### Authentication — how it works

Flutterwave v4 uses OAuth 2.0. The SDK exchanges your `clientId` and `clientSecret`
for a short-lived access token automatically on the first request, caches it, and
proactively refreshes it 60 seconds before it expires (tokens live for 10 minutes).
You never manage tokens manually.

> ⚠️  **Never expose `clientId` or `clientSecret` in browser/frontend code.**
> Instantiate the SDK on your server only. For browser-initiated payments, proxy
> the charge call through your own API route.

---

## Phone validation & network detection

Call this **before** rendering your payment form — use the result to show
the detected network badge and catch bad numbers early.

```ts
const r = flw.phone.validate("0772123456");

if (!r.valid) {
  showError(r.error);
  // "Unrecognised Uganda prefix…"
} else {
  console.log(r.network);    // "MTN"
  console.log(r.e164);       // "+256772123456"
  console.log(r.normalized); // "772123456"
}

// Just the network
const network = flw.phone.detectNetwork("0752000000"); // → "AIRTEL"
```

---

## Fee preview

Show the user exactly what they'll pay **before** they tap "Pay Now".

```ts
const fee = await flw.previewFees(10_000, "mobile_money");

console.log(flw.formatFee(fee));
// "UGX 10,000 + UGX 150 fee = UGX 10,150 total"

console.log(fee.chargeAmount); // 10150  ← what Flutterwave debits
console.log(fee.totalFee);     // 150
console.log(fee.breakdown);
// [{ type: "app", amount: 150 }]
```

---

## Charge — Mobile Money (MTN / Airtel)

```ts
import { generateTxRef } from "flw-ug-sdk";

const result = await flw.charge({
  type:        "mobile_money",
  amount:      10_000,          // UGX — fees added on top automatically
  phoneNumber: "0772123456",    // Network auto-detected: MTN
  // network:  "MTN",           // Optional explicit override
  customer: {
    email:     "john@example.com",
    firstName: "John",
    lastName:  "Mukasa",
  },
  narration: "LegalAdviser – Monthly subscription",
  reference: generateTxRef("LGL"), // Optional; auto-generated if omitted
  meta: { userId: "usr_123", plan: "monthly" },
});

console.log(result.status);       // "pending"
console.log(result.chargeAmount); // 10150
console.log(flw.formatFee(result.fees));

// Show the user what to do
if (result.nextAction.type === "payment_instruction") {
  showToast(result.nextAction.instruction!);
  // "Please authorise this payment on your mobile device…"
}

// Store for verification later
saveToDb({ chargeId: result.chargeId, reference: result.reference });
```

---

## Charge — Card (direct, AES-256-GCM encrypted)

Card details are encrypted **inside the SDK** before the request is sent.
Your server never sees raw card data.

```ts
const result = await flw.charge({
  type:   "card",
  amount: 50_000,
  card: {
    cardNumber:  "4111111111111111",
    expiryMonth: "01",
    expiryYear:  "26",
    cvv:         "123",
  },
  customer: {
    email:     "jane@example.com",
    firstName: "Jane",
    lastName:  "Akello",
    phone:     "0703000000",
  },
  narration: "LegalAdviser – Consultation fee",
});

// Handle the next_action from the issuing bank
switch (result.nextAction.type) {
  case "requires_pin":
    const pin = await showPinModal();
    const afterPin = await flw.authorize(result.chargeId, { type: "pin", pin });
    // afterPin.nextAction may now be "requires_otp"
    handleNextAction(afterPin);
    break;

  case "requires_otp":
    const otp = await showOtpModal("Enter the OTP sent to your phone/email");
    await flw.authorize(result.chargeId, { type: "otp", code: otp });
    break;

  case "redirect":
    // 3DS: send the user to the bank's auth page
    window.location.href = result.nextAction.redirectUrl!;
    break;

  case "requires_additional_fields":
    // AVS (international cards)
    await flw.authorize(result.chargeId, {
      type: "avs",
      address: {
        city: "Kampala", country: "UG",
        line1: "Plot 12 Kampala Road",
        postalCode: "00256", state: "Central",
      },
    });
    break;

  case "none":
    // Completed in one step
    break;
}
```

---

## Charge — Bank / USSD

```ts
const result = await flw.charge({
  type:        "bank",
  amount:      25_000,
  accountBank: "STANBIC",  // Bank code from Flutterwave bank list
  customer: {
    email:     "peter@example.com",
    firstName: "Peter",
    lastName:  "Ssekandi",
    phone:     "0772000001",
  },
  narration: "Invoice #1042",
});

if (result.nextAction.redirectUrl) {
  window.location.href = result.nextAction.redirectUrl;
}
```

---

## Verify a transaction (always server-side)

**Never fulfil an order without server-side verification.**
Call this from your server after receiving a callback/webhook — not from the client.

```ts
const verified = await flw.verify(result.chargeId, {
  expectedAmount: result.chargeAmount, // Throws VERIFICATION_FAILED if mismatch
});

if (verified.status === "successful") {
  await fulfillOrder(verified.reference);
}
```

---

## Webhooks — handled on your server, not in this SDK

Webhooks are server-side infrastructure. Set your webhook URL once in the
Flutterwave dashboard. Here's a minimal Next.js App Router handler:

```ts
// app/api/payments/webhook/route.ts
export async function POST(req: Request) {
  const body   = await req.text();
  const secret = process.env.FLW_WEBHOOK_SECRET!;
  const hash   = req.headers.get("verif-hash") ?? "";

  // Always verify the signature first
  if (hash !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === "charge.completed" && event.data.status === "successful") {
    // Verify on your server before fulfilling
    const verified = await flw.verify(event.data.id, {
      expectedAmount: await getExpectedAmount(event.data.reference),
    });
    await fulfillOrder(verified.reference);
  }

  return new Response("OK");
}
```

> The SDK intentionally excludes webhook parsing — it's your server's
> responsibility, uses a static secret comparison (not HMAC), and requires
> no SDK dependency.

---

## Error handling

Every SDK method throws `FlwUgSdkError` on failure.

```ts
import { FlwUgSdkError } from "flw-ug-sdk";

try {
  const result = await flw.charge({ ... });
} catch (err) {
  if (err instanceof FlwUgSdkError) {
    switch (err.sdkError.code) {
      case "INVALID_PHONE":
        showError("Please enter a valid Uganda phone number.");
        break;
      case "INVALID_NETWORK":
        showError("Phone must be MTN or Airtel.");
        break;
      case "MISSING_ENCRYPTION_KEY":
        console.error("Add encryptionKey to FlwUgSdkConfig.");
        break;
      case "ENCRYPTION_FAILED":
        showError("Card encryption failed. Please retry.");
        break;
      case "TOKEN_FETCH_FAILED":
        console.error("OAuth2 token request failed:", err.sdkError.raw);
        break;
      case "TIMEOUT":
        showError("Request timed out. Check your connection.");
        break;
      case "VERIFICATION_FAILED":
        alertOpsTeam(err.sdkError.message); // Amount mismatch — do not fulfil
        break;
      case "API_ERROR":
        showError(err.sdkError.message);
        console.error(err.sdkError.raw);
        break;
    }
  }
}
```

---

## Config reference

| Option          | Type     | Required | Default     | Description                                               |
|-----------------|----------|----------|-------------|-----------------------------------------------------------|
| `clientId`      | string   | ✅        | —           | OAuth2 client ID from dashboard → API Settings.           |
| `clientSecret`  | string   | ✅        | —           | OAuth2 client secret. **Server-side only.**               |
| `encryptionKey` | string   |          | —           | AES-256 key for card payments. From API Settings.         |
| `environment`   | string   |          | `"sandbox"` | `"sandbox"` or `"production"`.                            |
| `callbackUrl`   | string   |          | —           | Per-transaction override. Use dashboard setting instead.  |
| `redirectUrl`   | string   |          | —           | Default redirect for 3DS / mobile money confirm pages.    |
| `timeoutMs`     | number   |          | `30000`     | Per-request timeout in milliseconds.                      |

---

## Uganda network prefix reference

| Network | Prefixes                     |
|---------|------------------------------|
| MTN     | 077x, 078x, 076x, 031x, 039x |
| Airtel  | 070x, 075x, 074x, 020x       |

---

## Notes

- **Token lifecycle:** Tokens expire every 10 minutes. The SDK auto-refreshes with a 60 s buffer — zero manual work.
- **Fee behaviour:** `previewFees()` is called before every charge; the resulting `chargeAmount` (base + fees) is what Flutterwave debits. `result.fees` gives you the full breakdown for display.
- **Idempotency:** Every POST/PUT auto-generates a fresh `X-Idempotency-Key`.
- **Bank transfer (PWBT):** Not available for UGX — Flutterwave only supports PWBT for NGN and GHS. The `bank` type uses USSD instead.
- **Retries:** Not built into the SDK — implement at your application layer with exponential back-off to avoid double-charging.
- **Settlements:** UGX local settlements within 24 hours. Mobile money refunds take 1–7 days.
