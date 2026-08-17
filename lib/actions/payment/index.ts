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
}): Promise<
  | {
      success: true;
      data: {
        reference:     string;
        transactionId: string;
        status:        TransactionStatus | string;
      };
    }
  | { success: false; error: string }
> => {  
  try {
    if (!params.userId || typeof params.userId !== "string") {
      return { success: false, error: "Unauthorized caller" };
    }

    const rawAmount = params.amount ?? params.amountUgx;
    if (!rawAmount || typeof rawAmount !== "number" || rawAmount < 1000 || rawAmount > 7_000_000) {
      return { success: false, error: "Invalid payment amount. Must be between 1,000 and 7,000,000 UGX" };
    }
    const amountUgx = Math.floor(rawAmount);

    // Derive USD amount strictly using trusted server exchange rate
    const amountUsd = amountUgx / USD_TO_UGX_EXCHANGE_RATE;
    const { provider } = parseUgandanNumber(params.msisdn);
    const method: TransactionMethod = provider === "MTN" ? "MTN" : "AIRTEL";
    const feeResult = pawapay.calculateFee(amountUgx);
    const total = amountUgx + feeResult.fee;

    // Deterministic external reference
    const generatedReference = pawapay.deposits.generateId();

    // Perform atomic idempotency claim via Firestore transaction
    type ClaimResult =
      | { isExisting: true; success: true; data: { reference: string; transactionId: string; status: TransactionStatus | string } }
      | { isExisting: true; success: false; error: string }
      | { isExisting: false; externalReference: string; transactionRef: FirebaseFirestore.DocumentReference; claimRef?: FirebaseFirestore.DocumentReference };

    const claimResult: ClaimResult = await db.runTransaction(async (transaction) => {
      if (params.idempotencyKey) {
        const claimDocId = `${params.userId}_${params.idempotencyKey}`;
        const claimRef = db.collection("idempotency_claims").doc(claimDocId);
        const claimSnap = await transaction.get(claimRef);

        if (claimSnap.exists) {
          const claimData = claimSnap.data() as {
            transactionId: string;
            reference: string;
            // Firestore stores the app-level status string, not the PawaPay SDK enum
            status: "PENDING" | "COMPLETED" | "FAILED" | "ACCEPTED" | string;
          };

          if (claimData.status === "FAILED") {
            return {
              isExisting: true,
              success: false,
              error: "Previous payment attempt with this key has failed. Please start a new payment.",
            };
          }

          return {
            isExisting: true,
            success: true,
            data: {
              reference: claimData.reference || claimData.transactionId,
              transactionId: claimData.transactionId,
              status: claimData.status,
            },
          };
        }

        const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(generatedReference);
        const txData: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> & { idempotencyKey?: string } = {
          userId: params.userId,
          type: "DEPOSIT",
          description: `Funds Deposit via Mobile Money (${method})`,
          amount: Math.round(amountUsd * 100),
          createdAt: FieldValue.serverTimestamp(),
          details: `Phone: ${params.msisdn}`,
          reference: generatedReference,
          status: "PENDING",
          fee: feeResult.fee,
          method,
          idempotencyKey: params.idempotencyKey,
        };

        transaction.set(transactionRef, txData);
        transaction.set(claimRef, {
          userId: params.userId,
          idempotencyKey: params.idempotencyKey,
          transactionId: generatedReference,
          reference: generatedReference,
          status: "PENDING",
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          isExisting: false,
          externalReference: generatedReference,
          transactionRef,
          claimRef,
        };
      }

      const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(generatedReference);
      const txData: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
        userId: params.userId,
        type: "DEPOSIT",
        description: `Funds Deposit via Mobile Money (${method})`,
        amount: Math.round(amountUsd * 100),
        createdAt: FieldValue.serverTimestamp(),
        details: `Phone: ${params.msisdn}`,
        reference: generatedReference,
        status: "PENDING",
        fee: feeResult.fee,
        method,
      };

      transaction.set(transactionRef, txData);
      return {
        isExisting: false,
        externalReference: generatedReference,
        transactionRef,
      };
    });

    if (claimResult.isExisting) {
      return claimResult;
    }

    const { externalReference, transactionRef, claimRef } = claimResult;

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

    if (result.status !== 'ACCEPTED') {
      await transactionRef.update({ status: "FAILED" }).catch((err) =>
        console.error("[initiateCheckoutPayment] Failed to mark tx as failed:", err)
      );
      if (claimRef) {
        await claimRef.update({ status: "FAILED" }).catch((err) =>
          console.error("[initiateCheckoutPayment] Failed to mark claim as failed:", err)
        );
      }
      
      return {
        success: false, 
        error: "Failed to initiate payment, Try again"
      };
    }
    
    return {
      success: true, 
      data: {
        reference:     result.depositId,
        transactionId: transactionRef.id,
        status:        result.status,
      }
    };
  } catch (err) {
    console.error("initiateCheckoutPayment error:", err);
    customPawapayError(err);
    return { success: false, error: "Failed to initiate payment" };
  }
}