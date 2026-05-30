"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS, CALLBACK_URL } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { wallet } from "@/lib/payments";
import {
  withSsentezo,
  type SsentezoActionResult,
  type TransactionStatus,
} from "@/lib/ssentezo";
import { generateTxRef } from "@/utils";
import { parseUgandanNumber } from "@/utils";

// ── Verify a phone number ─────────────────────────────────────────────────────

/**
 * Verify the name on a mobile money number before showing the payment
 * confirmation step to the user.
 */
export async function verifyPhoneNumber(
  msisdn: string
): Promise<SsentezoActionResult<{ fullName: string; msisdn: string }>> {
  return withSsentezo(async () => {
    const data = await wallet.msisdn.verify(msisdn);
    return { fullName: `${data.FirstName} ${data.Surname}`.trim(), msisdn: data.msisdn };
  });
}

// ── Test-page initiatePayment (no Firestore — kept for app/test/wallet) ───────

export async function initiatePayment(params: {
  msisdn: string;
  amount: number;
}): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
  const externalReference = generateTxRef();

  return withSsentezo(async () => {
    const result = await wallet.transactions.deposit({
      externalReference,
      msisdn:          params.msisdn,
      amount:          params.amount,
      reason:          "Wallet Top Up",
      successCallback: CALLBACK_URL,
      failureCallback: CALLBACK_URL,
    });

    return { reference: externalReference, status: result.transactionStatus };
  });
}

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
export async function initiateCheckoutPayment(params: {
  userId:     string;
  msisdn:     string;
  amountUgx:  number;
  amountUsd:  number;
  userName?:  string;
}): Promise<
  SsentezoActionResult<{
    reference:     string;
    transactionId: string;
    status:        TransactionStatus;
  }>
> {
  const externalReference = generateTxRef();

  // Detect provider from phone prefix for storage/display purposes
  const { provider } = parseUgandanNumber(params.msisdn);
  const method: TransactionMethod = provider === "MTN" ? "MTN" : "AIRTEL";

  // Pre-create Firestore transaction record in "pending" state.
  // If Ssentezo later fails, we mark it "failed" below.
  const transactionRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
  const fee = params.amountUgx * 0.025;
const total = params.amountUgx + fee;
  const result = await withSsentezo(async () => {
    const res = await wallet.transactions.deposit({
      externalReference,
      msisdn:          params.msisdn,
      amount:          total,
      reason:          "Wallet Top Up",
      name:            params.userName,
      successCallback: CALLBACK_URL,
      failureCallback: CALLBACK_URL,
    });

    console.log("transaction result", res);
    console.log("Amount UGX", params.amountUgx);
    console.log("Amount USD", params.amountUsd);
    console.log("Amount Total", total);

     const transaction: FirestoreWrite<Omit<Transaction, "id">, "createdAt"> = {
            userId: params.userId,
            type: "DEPOSIT",
            description: `Funds Deposit via Mobile Money (${method})`,
            amount: params.amountUsd * 100,
            createdAt: FieldValue.serverTimestamp(),
            details: `Phone: ${params.msisdn}`,
            reference: externalReference,
            status: "pending",
            method,
            ssentezoWalletReference: res.ssentezoWalletReference,
            financialTransactionId: res.financialTransactionId,
          };

      await transactionRef.set({
      ...transaction
      });

    return {
      reference:     externalReference,
      transactionId: transactionRef.id,
      status:        res.transactionStatus,
    };
  });

  // Best-effort: if Ssentezo rejected the request, mark the pre-created doc failed
  if (!result.success) {
    await transactionRef.update({ status: "failed" }).catch((err) =>
      console.error("[initiateCheckoutPayment] Failed to mark tx as failed:", err)
    );
  }

  return result;
}