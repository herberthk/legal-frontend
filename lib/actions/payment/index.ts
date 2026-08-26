"use server";

import { customPawapayError } from "@/sdk/error";
import { pawapay } from "@/sdk";
import {
  initiateDeposit,
  type InitiateDepositResult,
} from "@/services/payment";
import { getAuthenticatedUserId } from "../auth";

// ── Verify a phone number ─────────────────────────────────────────────────────

/**
 * Verify the name on a mobile number before showing the payment
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



/**
 * Initiates a real mobile money deposit via PawaPay and records the
 * pending transaction in Firestore. The callback route will finalise it.
 *
 * This is the **web** entry point: it resolves identity from the `session`
 * cookie and delegates the actual work to `initiateDeposit` in
 * `services/payment.ts`. Because this file is `"use server"`, every export here
 * is a browser-callable RPC endpoint — so a client-supplied `params.userId` is
 * only ever accepted when it matches the cookie-verified uid, never trusted on
 * its own.
 *
 * Mobile callers must NOT use this action (a Bearer client has no cookie);
 * `app/api/v1/payments/momo/deposit/route.ts` calls `initiateDeposit` directly
 * with the uid it verified from the Firebase ID token.
 *
 * @param params.userId      - Optional Firebase UID (must match the session uid if given)
 * @param params.msisdn      - Phone in 256XXXXXXXXX format (already validated)
 * @param params.amount      - Raw UGX integer (1,000–7,000,000)
 * @param params.amountUgx   - Backward-compatible alias for amount
 * @param params.userName    - Optional display name sent to PawaPay
 * @param params.idempotencyKey - Required unique key (1-128 chars) for atomic idempotency
 */
export const initiateCheckoutPayment = async (params: {
  userId?:         string;
  msisdn:          string;
  amount?:         number;
  amountUgx?:      number;
  amountUsd?:      number;
  userName?:       string;
  idempotencyKey:  string;
}): Promise<InitiateDepositResult> => {
  const sessionUserId = await getAuthenticatedUserId();
  if (!sessionUserId) {
    return { success: false, error: "Unauthorized caller", terminal: true };
  }

  if (params.userId && params.userId !== sessionUserId) {
    return { success: false, error: "Unauthorized caller", terminal: true };
  }

  return initiateDeposit({
    userId:         sessionUserId,
    msisdn:         params.msisdn,
    amount:         params.amount,
    amountUgx:      params.amountUgx,
    userName:       params.userName,
    idempotencyKey: params.idempotencyKey,
  });
};
