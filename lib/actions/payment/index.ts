"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
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
  // console.log(result)
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
 * Initiates a real mobile money deposit via PawaPay and records the
 * pending transaction in Firestore. The callback route will finalise it.
 *
 * @param params.userId      - Firebase UID of the paying user
 * @param params.msisdn      - Phone in 256XXXXXXXXX format (already validated)
 * @param params.amount      - Raw UGX integer (1,000–7,000,000)
 * @param params.amountUgx   - Backward-compatible alias for amount
 * @param params.userName    - Optional display name sent to PawaPay
 */
export const initiateCheckoutPayment = async (params: {
  userId:          string;
  msisdn:          string;
  amount?:         number;
  amountUgx?:      number;
  amountUsd?:      number;
  userName?:       string;
  idempotencyKey?: string;
}): Promise<{success:boolean, data?: {
    reference:     string;
    transactionId: string;
    status:        TransactionStatus;
  }} | {success:false, error: string}> =>
 {  
  try {
    const rawAmount = params.amount ?? params.amountUgx;
    if (!rawAmount || typeof rawAmount !== "number" || rawAmount <= 0) {
      return { success: false, error: "Invalid payment amount" };
    }
    const amountUgx = Math.floor(rawAmount);

    // If an idempotency key is supplied, check for an existing transaction
    if (params.idempotencyKey) {
      const existingSnap = await db
        .collection(COLLECTIONS.TRANSACTIONS)
        .where("userId", "==", params.userId)
        .where("idempotencyKey", "==", params.idempotencyKey)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data() as Transaction;
        return {
          success: true,
          data: {
            reference: existingData.reference || existingDoc.id,
            transactionId: existingDoc.id,
            status: existingData.status as TransactionStatus,
          },
        };
      }
    }

    // Derive USD amount strictly using trusted server exchange rate
    const amountUsd = amountUgx / USD_TO_UGX_EXCHANGE_RATE;

    const externalReference = pawapay.deposits.generateId(); // UUIDv4;

    // Detect provider from phone prefix for storage/display purposes
    const { provider } = parseUgandanNumber(params.msisdn);
    const method: TransactionMethod = provider === "MTN" ? "MTN" : "AIRTEL";
    const feeResult = pawapay.calculateFee(amountUgx);

    // Pre-create Firestore transaction record in "pending" state.
    // If PawaPay later fails, we mark it "failed" below.
    const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(externalReference);
    const total = amountUgx + feeResult.fee;
    const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> & { idempotencyKey?: string } = {
      userId: params.userId,
      type: "DEPOSIT",
      description: `Funds Deposit via Mobile Money (${method})`,
      amount: Math.round(amountUsd * 100),
      createdAt: FieldValue.serverTimestamp(),
      details: `Phone: ${params.msisdn}`,
      reference: externalReference,
      status: "PENDING",
      fee: feeResult.fee,
      method,
      ...(params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : {}),
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
        { baseAmount: amountUgx }
      ]
    });

    if(result.status !=='ACCEPTED'){
      await transactionRef.update({ status: "FAILED" }).catch((err) =>
      console.error("[initiateCheckoutPayment] Failed to mark tx as failed:", err)
    );
    
    return {
      success:false, 
      error: "Failed to initiate payment, Try again"}
    }
    
    return {
      success:true, 
      data: {
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