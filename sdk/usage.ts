import { FailureCode, pawapay, PawaPayApiError, PawaPayNetworkError, PawaPayValidationError } from ".";

// const apiToken = "eyJraWQiOiIxIiwiYWxnIjoiRVMyNTYifQ.eyJ0dCI6IkFBVCIsInN1YiI6IjIyNzI4IiwibWF2IjoiMSIsImV4cCI6MjA5NjU0MjQ5NiwiaWF0IjoxNzgwOTIzMjk2LCJwbSI6IkRBRixQQUYiLCJqdGkiOiI5MTJlYjI3NS05ZGY4LTQ1MGYtYmY1Yy1lNDI4ZGRiMjNlYWIifQ.kS-dclKCW34SaBmEtZTue1TudtJ5nWw4SbIqPW3MS78ZxAp09oy95BhTuLv2sdXIzFRvhyjeuQnMOyKTaxhH4A";
//const depositId = randomUUID(); // Store this before calling the API!

// const response = await fetch("https://api.sandbox.pawapay.io/v2/deposits", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json",
//     "Authorization": "Bearer "+apiToken,
//   },
//   body: JSON.stringify({
//     depositId,
//     amount: "150000",       // UGX, no decimals for Airtel
//     currency: "UGX",
//     payer: {
//       type: "MMO",
//       accountDetails: {
//         phoneNumber: "256703752696", // Uganda country code: 256, no leading zero
//         provider: "AIRTEL_OAPI_UGA", // or "MTN_MOMO_UGA"
//       },
//     },
//   }),
// });

// const result = await response.json();
// console.log(result); // "ACCEPTED", "REJECTED", or "DUPLICATE_IGNORED"

// 1. Collect from a customer (deposit)
const depositId = pawapay.deposits.generateId(); // UUIDv4

try {
  const deposit = await pawapay.deposits.initiate({
  depositId,
  payer: {
    type: "MMO",
    accountDetails: {
      phoneNumber: "256700123456", // digits-only, with country code (auto-detects AIRTEL_OAPI_UGA)
    },
  },
  amount: "80000",
  currency: "UGX",
  customerMessage: "Wallet topup",
  // metadata: [{ orderId: "ORD-001" }],
});
console.log(deposit)
// if (deposit.status === TransactionStatus.ACCEPTED) {
//   console.log("Deposit accepted — waiting for callback or polling...");
// }
} catch (err) {
  if (err instanceof PawaPayValidationError) {
    // Client-side validation failed — no network call was made
    console.error("Bad request:", err.message, "field:", err.field);
  } else if (err instanceof PawaPayApiError) {
    // API returned a structured error
    console.error("API error:", err.failureCode, err.failureMessage);

    if (err.failureCode === FailureCode.PROVIDER_TEMPORARILY_UNAVAILABLE) {
      // Schedule a retry later
      console.log("Provider temporarily unavailable - retry later")
    }
    if (err.isAuthError) {
      // Token invalid / expired
      console.log("Token invalid / expired")
    }
  } else if (err instanceof PawaPayNetworkError) {
    // Timeout, DNS failure, etc.
    console.error("Network error:", err.message);
  }
}