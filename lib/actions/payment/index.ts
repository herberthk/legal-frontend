"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";


import { parseUgandanNumber } from "@/utils";
import { customPawapayError } from "@/sdk/error";
import { pawapay, TransactionStatus } from "@/sdk";

// ── Verify a phone number ─────────────────────────────────────────────────────

/**
 * Verify the name on a mobile money number before showing the payment
 * confirmation step to the user.
 */
export async function verifyPhoneNumber(
  msisdn: string
): Promise<{ success: boolean, data?: { fullName: string; msisdn: string } } | {success: boolean, error: string}> {

  try {
  const result = await pawapay.msisdn.verify(msisdn)
  console.log(result)
  if(result.response !== 'OK') {
    throw new Error("Failed to verify phone number")
  }
  return { success: true, data: { fullName: `${result.data.FirstName} ${result.data.Surname}`.trim(), msisdn: result.data.msisdn }};
} catch (error) {
  console.log(error)
  customPawapayError(error)
  return { success: false, error: "Failed to verify phone number" };
}
}

// ── Test-page initiatePayment (no Firestore — kept for app/test/wallet) ───────

// export async function initiatePayment(params: {
//   msisdn: string;
//   amount: number;
// }): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
//   const externalReference = generateTxRef();

//   //@ts-ignore
//   return withSsentezo(async () => {
//     const result = await wallet.transactions.deposit({
//       externalReference,
//       msisdn:          params.msisdn,
//       amount:          params.amount,
//       reason:          "Wallet Top Up",
//       successCallback: CALLBACK_URL,
//       failureCallback: CALLBACK_URL,
//     });

//     return { reference: externalReference, status: result.transactionStatus };
//   });
// }

// ── Full checkout payment (with Firestore persistence) ────────────────────────

/**
 * Initiates a real mobile money deposit via Ssentezo and records the
 * pending transaction in Firestore. The callback route will finalise it.
 *
 * @param params.userId      - Firebase UID of the paying user
 * @param params.msisdn      - Phone in 256XXXXXXXXX format (already validated)
 * @param params.amountUgx   - Raw UGX integer (500–7,000,000). Min enforced: 1000
 * @param params.amountUsd   - Original USD amount for receipt display
 * @param params.userName    - Optional display name sent to Ssentezo
 */
export const initiateCheckoutPayment = async (params: {
  userId:     string;
  msisdn:     string;
  amountUgx:  number;
  amountUsd:  number;
  userName?:  string; 
}): Promise<{success:boolean, data?: {
    reference:     string;
    transactionId: string;
    status:        TransactionStatus;
  }} | {success:false, error: string}> =>
 {  
  try{
  const externalReference = pawapay.deposits.generateId(); // UUIDv4;

  // Detect provider from phone prefix for storage/display purposes
  const { provider } = parseUgandanNumber(params.msisdn);
  const method: TransactionMethod = provider === "MTN" ? "MTN" : "AIRTEL";
  const feeResult = pawapay.calculateFee(params.amountUgx);

  // Pre-create Firestore transaction record in "pending" state.
  // If Ssentezo later fails, we mark it "failed" below.
  const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
  const total = params.amountUgx + feeResult.fee;
     const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
            userId: params.userId,
            type: "DEPOSIT",
            description: `Funds Deposit via Mobile Money (${method})`,
            amount: params.amountUsd * 100,
            createdAt: FieldValue.serverTimestamp(),
            details: `Phone: ${params.msisdn}`,
            reference: externalReference,
            status: "PENDING",
            fee:feeResult.fee,
            method,
          };

      await transactionRef.set({
      ...transaction
      });

       const result = await pawapay.deposits.initiate({
      depositId: externalReference,
      payer: {
        type: "MMO",
        accountDetails: {
          phoneNumber: params.msisdn,
        },
      },
      amount: total.toString(),
      currency: "UGX",
      customerMessage: "Wallet Topup",
      metadata: [
    { baseAmount: params.amountUgx, fee: feeResult.fee }
  ]
    });
     console.log("transaction result", result);
    console.log("Amount UGX", params.amountUgx);
    console.log("Amount USD", params.amountUsd);
    console.log("Amount Total", total);
    if(result.status !=='ACCEPTED'){
      await transactionRef.update({ status: "FAILED" }).catch((err) =>
      console.error("[initiateCheckoutPayment] Failed to mark tx as failed:", err)
    );
    }
    
    return {success:true, data: {
      reference:     result.depositId,
      transactionId: transactionRef.id,
      status:        result.status,
    }}
  }catch(err){
    console.log(err)
    customPawapayError(err)
    return {success:false, error:"Failed to initiate payment"}
  }
}