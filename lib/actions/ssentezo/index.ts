"use server";

import { CALLBACK_URL } from "@/constants";
import { wallet } from "@/lib/payments";
import {
  SsentezoActionResult,
  TransactionStatus,
  withSsentezo,
} from "@/lib/ssentezo";
import { generateTxRef } from "@/utils";

export interface InitiatePaymentResult {
  success:   boolean;
  reference?: string;
  error?:    string;
  fieldErrors?: Record<string, string[]>;
}

export interface VerifyNumberResult {
  success:  boolean;
  fullName?: string; 
  error?:   string;
}

// ── Verify a phone number ─────────────────────────────────────────────────────

/**
 * Verify the name on a mobile money number before showing a payment
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

/**
 * Initiate a mobile money payment collection.
 */
// export async function initiatePayment(params: {
//   msisdn:  string;
//   amount:  number;
//   reason:  string;
//   orderId: string;
// }): Promise<InitiatePaymentResult> {
//   const externalReference = generatePrefixedReference(`order_${params.orderId}`);

//   try {
//     await wallet.transactions.deposit({
//       externalReference,
//       msisdn:          params.msisdn,
//       amount:          params.amount,
//       reason:          params.reason,
//       successCallback: CALLBACK_URL,
//       failureCallback:  CALLBACK_URL,
//     });

//     return { success: true, reference: externalReference };
//   } catch (err) {
//     if (isSsentezoValidationError(err)) {
//       return { success: false, error: err.message, fieldErrors: err.fieldErrors };
//     }
//     if (err instanceof SsentezoError) {
//       return { success: false, error: err.message };
//     }
//     return { success: false, error: "Payment initiation failed. Please try again." };
//   }
// }

export async function initiatePayment(params: {
  msisdn: string;
  amount: number;
}): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
  const externalReference = generateTxRef();
  const reason = "Consultation Fee";

  // withSsentezo catches, classifies, and returns { success, error, kind, fieldErrors }
  // — no try/catch needed here at all.
  return withSsentezo(async () => {
    const result = await wallet.transactions.deposit({
      externalReference,
      msisdn:          params.msisdn,
      amount:          params.amount,
      reason:          reason,
      successCallback: CALLBACK_URL,
      failureCallback:  CALLBACK_URL,
    });

    // Persist the reference in your DB here before returning:
    // await db.order.update({ where: { id: params.orderId }, data: { paymentRef: externalReference } });

    return { reference: externalReference, status: result.transactionStatus };
  });
}