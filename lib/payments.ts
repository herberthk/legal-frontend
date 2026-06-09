// import "server-only";                  // Build-time guard: import fails on client
import { getSsentezoWallet } from "./ssentezo";
import { FlwUganda } from "./flutterwave";
export const wallet = getSsentezoWallet();

export const flw = new FlwUganda({
  clientId:      process.env.FLW_CLIENT_ID,      // From Flutterwave dashboard → API Settings
  clientSecret:  process.env.FLW_CLIENT_SECRET,  // From Flutterwave dashboard → API Settings
  encryptionKey: process.env.FLW_ENCRYPTION_KEY, // Required only for card payments
  environment:   "sandbox",   // → "production" when going live

  // Both optional — use only if you need per-transaction URL overrides.
  // In most cases, set these once in the Flutterwave dashboard instead.
//   callbackUrl:  "https://yourapp.ug/api/payments/callback",
//   redirectUrl:  "https://yourapp.ug/payment/complete",
});