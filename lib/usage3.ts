

// const r = flw.phone.validate("0702123456");

// import { flw } from "./payments";

// if (!r.valid) {
//   console.log(r.error);
//   // "Unrecognised Uganda prefix…"
// } else {
//   console.log(r.network);    // "MTN"
//   console.log(r.e164);       // "+256772123456"
//   console.log(r.normalized); // "772123456"
// }

// Just the network
// const network = flw.phone.detectNetwork("0752000000"); // → "AIRTEL"

// console.log(network);

// const amount = 78000;
// const fee = await flw.previewFees(amount, "bank");

// console.log(flw.formatFee(fee));
// // "UGX 10,000 + UGX 150 fee = UGX 10,150 total"

// const chargeAmount = fee.chargeAmount
// console.log("flutterwave charges:", chargeAmount)
// console.log("totalFee:", fee.totalFee);
// console.log("breakdown:", fee.breakdown);

// Charge — Mobile Money (MTN / Airtel)
// try {
//   const result = await flw.charge({
//     type:        "mobile_money",
//     amount:      chargeAmount,          // UGX — fees added on top automatically
//     phoneNumber: "0772123456",    // Network auto-detected: MTN
   
//     customer: {
//       email:     "john@example.com",
//       firstName: "John",
//       lastName:  "Mukasa",
//     },
//     narration: "LegalAdviser – Monthly subscription",
//     meta: { userId: "usr_123", plan: "monthly" },
//   });

//   console.log('status', result.status);       // "pending"
//   console.log('chargeAmount',result.chargeAmount);
//   console.log('fees',flw.formatFee(result.fees));
//   console.log('reference', result.reference);
//   console.log('chargeId', result.chargeId);
//   console.log('currency', result.currency);

//   console.log('createdAt', result.createdAt);

//   // Show the user what to do
//   if (result.nextAction.type === "payment_instruction") {
//   //   showToast(result.nextAction.instruction!);
//     // "Please authorise this payment on your mobile device…"
//     console.log("instruction", result.nextAction.instruction);
//   }
  
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// } catch (err: any) {
//   console.error("SDK Error details:", JSON.stringify(err.sdkError?.raw, null, 2));
// }

// Charge — Card (direct, AES-256-GCM encrypted)
// try {
// const result = await flw.charge({
//   type:   "card",
//   amount: chargeAmount,
//   card: {
//     cardNumber:  "4111111111111111",
//     expiryMonth: "01",
//     expiryYear:  "28",
//     cvv:         "123",
//   },
//   customer: {
//     email:     "jane@example.com",
//     firstName: "Jane",
//     lastName:  "Akello",
//     phone:     "0703000000",
//   },
//   narration: "LegalAdviser – Consultation fee",
// });

// console.log("chargeAmount", result.chargeAmount);
// console.log("status", result.status);
// console.log("fees", flw.formatFee(result.fees));
// console.log("reference", result.reference);
// console.log("chargeId", result.chargeId);
// console.log("currency", result.currency);
// console.log('createdAt', result.createdAt);
// console.log('nextAction', result.nextAction);
// // Handle the next_action from the issuing bank
// switch (result.nextAction.type) {
//   case "requires_pin":
//     const pin = "123456"
//     const afterPin = await flw.authorize(result.chargeId, { type: "pin", pin });
//     // afterPin.nextAction may now be "requires_otp"
//     console.log("afterPin", afterPin);
//     break;

//   case "requires_otp":
//     const otp = "123456";
//     await flw.authorize(result.chargeId, { type: "otp", code: otp });
//     break;

//   case "redirect":
//     // 3DS: send the user to the bank's auth page
//     window.location.href = result.nextAction.redirectUrl!;
//     break;

//   case "requires_additional_fields":
//     // AVS (international cards)
//     await flw.authorize(result.chargeId, {
//       type: "avs",
//       address: {
//         city: "Kampala", country: "UG",
//         line1: "Plot 12 Kampala Road",
//         postalCode: "00256", state: "Central",
//       },
//     });
//     break;

//   case "none":
//     // Completed in one step
//     console.log('Payment completed in one step');
//     break;
// }
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// } catch (err: any) {
//   console.error("SDK Error details:", JSON.stringify(err.sdkError?.raw, null, 2));
// }

// ── 1. Fetch Supported Banks, Branches & Resolve Account ─────────────────────
// console.log("\n--- Fetching Supported Banks ---");
// try {
//   const banks = await flw.getBanks();
//   console.log(`Found ${banks.length} supported banks in Uganda.`);
//   console.log("First 2 banks:", banks.slice(0, 2).map(b => `${b.code}: ${b.name}`));

//   // If banks were found, let's try fetching branches for the first one
//   if (banks.length > 0) {
//     const firstBank = banks[0];
//     console.log(`\n--- Fetching Branches for ${firstBank.name} (${firstBank.id}) ---`);
//     try {
//       const branches = await flw.getBankBranches(firstBank.id);
//       console.log(`Found ${branches.length} branches.`);
//       if (branches.length > 0) {
//         console.log("First first branch:", branches[0]);
//       }
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     } catch (err: any) {
//       console.log("Could not fetch branches:", err.message);
//     }
    
//     // Let's test resolving a dummy account
//     console.log(`\n--- Resolving Account at ${firstBank.name} ---`);
//     try {
//       const resolved = await flw.resolveBankAccount("1234567890", firstBank.name);
//       console.log("Resolved Account:", resolved);
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     } catch (err: any) {
//       console.log("Account resolve failed (expected for dummy data):", err.sdkError?.raw?.error?.message || err.message);
//     }
//   }

// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// } catch (err: any) {
//   console.error("Failed to fetch banks:", err.message);
// }

// ── 2. Charge — Bank / USSD ──────────────────────────────────────────────────
// try {
// const result = await flw.charge({
//   type:        "bank",
//   amount:      chargeAmount,
//   accountBank: "STANBIC BANK LIMITED",  // You should use a valid bank code from getBanks()
//   customer: {
//     email:     "peter@example.com",
//     firstName: "Peter",
//     lastName:  "Ssekandi",
//     phone:     "0772000001",
//   },
//   narration: "Invoice #1042",
// });

// if (result.nextAction.redirectUrl) {
//   window.location.href = result.nextAction.redirectUrl;
// }

// ── 3. Verify Transaction Status ───────────────────────────────────────────────
// You should verify the transaction using the chargeId before giving value
// to the user. This is crucial for security!
// console.log("\n--- Verifying Transaction ---");
//   // Pass the chargeId returned from the charge method
//   const verification = await flw.verify(result.chargeId);
//   console.log("Verification Status:", verification.status);
//   console.log("Amount Paid:", verification.amount);
  
//   if (verification.status === "successful") {
//     console.log("Payment successful! Fulfilling order...");
//   } else {
//     console.log(`Payment is ${verification.status}. Waiting for user action.`);
//   }
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// } catch (err: any) {
//   console.error("SDK Error details:", JSON.stringify(err.sdkError?.raw, null, 2));
// }