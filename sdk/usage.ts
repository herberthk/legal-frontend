import { formatAmount, OperationType, pawapay, pollUntilFinal, pollUntilFinalOrThrow, validatePhoneNumber, verifyContentDigest } from ".";
import { customPawapayError } from "./error";

// 1. Collect from a customer (deposit)
//const depositId = pawapay.deposits.generateId(); // UUIDv4

const result = pawapay.calculateFee(190000);
// try {
//   const deposit = await pawapay.deposits.initiate({
//   depositId,
//   payer: {
//     type: "MMO",
//     accountDetails: {
//       phoneNumber: "256700123456", // digits-only, with country code (auto-detects AIRTEL_OAPI_UGA)
//     },
//   },
//   amount: result.total.toString(),
//   currency: "UGX",
//   customerMessage: "Wallet topup",
//   // metadata: [{ orderId: "ORD-001" }],
// });
// console.log(deposit)
// // if (deposit.status === TransactionStatus.ACCEPTED) {
// //   console.log("Deposit accepted — waiting for callback or polling...");
// // }
// } catch (err) {
// customPawapayError(err)
// }

// Check Transaction status

// try {
//   const status = await pawapay.deposits.checkStatus('e5c019f8-bf67-4b30-80cb-0841b3bd4087');
//   console.log(status)
// } catch (error) {
//   customPawapayError(error)
// }


// Single payout
// const payoutId = pawapay.payouts.generateId();
// try {
//   const payout = await pawapay.payouts.initiate({
//   payoutId,
//   recipient: {
//     type: "MMO",
//     accountDetails: { phoneNumber: "256700123456" }, // provider auto-detected
//   },
//   amount: "170000",
//   currency: "UGX",
//   customerMessage:"Payout Request",
 
// });
// console.log("Payout result:", payout)
// } catch (error) {
//   customPawapayError(error)
// }

// Checkout payout status
// try {
//   const status = await pawapay.payouts.checkStatus('efa1bfe8-5b34-4810-8fe6-c54550798fc2');
//   console.log(status)
// } catch (error) {
//   customPawapayError(error)
// }

// Refunds
try {
const refundId = pawapay.refunds.generateId();
const refund = await pawapay.refunds.initiate({
  refundId,
  depositId: 'f182d260-35b7-45af-962f-069169b2c8bb',
  amount: "700",
  currency: "UGX",
});
console.log("Refund result:", refund)
} catch (error) {
  customPawapayError(error)
}

// try {
// const status = await pawapay.refunds.checkStatus('83987a50-dfa8-454b-bd0c-28f10e19877a');
// console.log("Refund status:", status)
// } catch (error) {
//   customPawapayError(error)
// }

// Predict provider and sanitise phone number
// try {
// const { provider, phoneNumber, country } =
//   await pawapay.toolkit.predictProvider({
//     phoneNumber: "+256 700-123456",
//   });
// console.log("Provider:", provider);
// console.log("Phone Number:", phoneNumber);
// console.log("Country:", country);
// } catch (error) {
//   customPawapayError(error)
// }

// Get your full account configuration (limits, currencies, auth types)
// try {
// const config = await pawapay.toolkit.getActiveConfiguration();
// const ugaProviders =
//   config.countries.find((c) => c.country === "UGA")?.providers ?? [];
// console.log("Providers:", ugaProviders);
// console.log("Config:", config);
// } catch (error) {
//   customPawapayError(error)
// }


// Filter by country + operation type
// try {
// const ugaDeposits = await pawapay.toolkit.getActiveConfiguration({
//   country: "UGA",
//   operationType: OperationType.DEPOSIT,
// });
// console.log("Providers:", ugaDeposits);
// console.log("UGA Deposits:", ugaDeposits.countries[0].providers);
// } catch (error) {
//   customPawapayError(error)
// }

// Real-time provider availability
// try {
// const availability = await pawapay.toolkit.getProviderAvailability();
// console.log("Provider availability:", availability);
// } catch (error) {
//   customPawapayError(error)
// }

// Polling for async results

// pawaPay is async — `ACCEPTED` means the request was queued, not completed.
// Use `pollUntilFinal` when you don't have webhook callbacks configured.

// Option A: non-throwing
// try {
// const { response, resolved } = await pollUntilFinal(
//   () => pawapay.deposits.checkStatus('e5c019f8-bf67-4b30-80cb-0841b3bd4087'),
//   { maxAttempts: 20, intervalMs: 3_000 },
// );
// console.log(resolved ? response.finalStatus : "Timed out");
// console.log("Response:", response);
// console.log("Resolved:", resolved);
// } catch (error) {
//   customPawapayError(error)
// }


// Option B: throws if no final state reached
// try {
// const final = await pollUntilFinalOrThrow(
//   () => pawapay.deposits.checkStatus('e5c019f8-bf67-4b30-80cb-0841b3bd4087'),
//   {
//     maxAttempts: 30,
//     intervalMs: 5_000,
//     onAttempt: (n) => console.log(`Attempt ${n}`),
//   },
// );
// console.log(final.finalStatus); // 'COMPLETED' | 'FAILED'
// } catch (error) {
//   customPawapayError(error)
// }

// Fee Calculator

// PawaPay charges a **3% platform fee** on all Uganda (UGX) transactions. Use `calculateFee` to show customers the exact fee and total _before_ initiating a transaction.

// ── Standalone functions ────────────────────────────────────────────────────
// const result = pawapay.calculateFee(90000, "UGA");

// console.log(result.amount); 
// console.log(result.fee); 
// console.log(result.total); 
// console.log(result.currency); 
// console.log(result.formatted);

// // Net amount the merchant receives after PawaPay deducts its fee
// const net = pawapay.netAmount(150_000, "UGA");
// console.log('Net amount:', net);

// // Format amount for UI (e.g. "UGX 3,000")
// const formatted = formatAmount(90000, 2);
// console.log("Formatted:", formatted); // "UGX 90,000"

// const digestValid = await verifyContentDigest(
//     rawBody,
//     (req.headers["content-digest"] as string) ?? "",
//   );
