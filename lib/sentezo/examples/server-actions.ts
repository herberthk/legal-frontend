// ─────────────────────────────────────────────────────────────────────────────
//  Ssentezo Wallet SDK — Next.js Server Action Examples
//  Uses withSsentezo() to eliminate repetitive try/catch boilerplate.
// ─────────────────────────────────────────────────────────────────────────────

"use server";

import {
  getSsentezoWallet,
  generatePrefixedReference,
  withSsentezo,
  type SsentezoActionResult,
  type TransactionStatus,
  type Bank,
} from "../";

const wallet = getSsentezoWallet();

// ── Collect payment (deposit) ─────────────────────────────────────────────────

/**
 * Initiate a mobile money payment collection.
 *
 * @example
 * const result = await collectPayment({ msisdn: "256709920188", amount: 10_000, reason: "Order #1", orderId: "abc" });
 * if (result.success) console.log(result.data.ssentezoWalletReference);
 * else console.error(result.error, result.fieldErrors);
 */
export async function collectPayment(params: {
  msisdn: string;
  amount: number;
  reason: string;
  orderId: string;
}): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
  const externalReference = generatePrefixedReference(`order_${params.orderId}`);

  // withSsentezo catches, classifies, and returns { success, error, kind, fieldErrors }
  // — no try/catch needed here at all.
  return withSsentezo(async () => {
    const result = await wallet.transactions.deposit({
      externalReference,
      msisdn:          params.msisdn,
      amount:          params.amount,
      reason:          params.reason,
      successCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
      failureCallback:  `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
    });

    // Persist the reference in your DB here before returning:
    // await db.order.update({ where: { id: params.orderId }, data: { paymentRef: externalReference } });

    return { reference: externalReference, status: result.transactionStatus };
  });
}

// ── Disburse payment (withdraw) ───────────────────────────────────────────────

/**
 * Send money from your wallet to a recipient's mobile money account.
 */
export async function disbursePayment(params: {
  msisdn: string;
  amount: number;
  reason: string;
  payoutId: string;
  recipientName?: string;
}): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
  const externalReference = generatePrefixedReference(`payout_${params.payoutId}`);

  return withSsentezo(async () => {
    const result = await wallet.transactions.withdraw({
      externalReference,
      msisdn:   params.msisdn,
      amount:   params.amount,
      reason:   params.reason,
      name:     params.recipientName,
    });
    return { reference: externalReference, status: result.transactionStatus };
  });
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

// ── Check transaction status ──────────────────────────────────────────────────

/**
 * Poll the status of a mobile money transaction.
 * Prefer callbacks in production; use this for one-off checks.
 */
export async function checkPaymentStatus(
  externalReference: string
): Promise<SsentezoActionResult<{ status: TransactionStatus; amount: number }>> {
  return withSsentezo(async () => {
    const data = await wallet.transactions.getStatus(externalReference);
    return { status: data.transactionStatus, amount: data.amount };
  });
}

// ── Get supported banks ───────────────────────────────────────────────────────

/**
 * Get the list of banks supported by Ssentezo (cached for 1 hour).
 */
export async function getSupportedBanks(): Promise<
  SsentezoActionResult<{ id: number; name: string }[]>
> {
  return withSsentezo(async () => {
    const banks = await wallet.bankTransfer.getBanks();
    return banks.map((b: Bank) => ({ id: b.id, name: b.bank_name }));
  });
}

// ── Initiate a bank transfer ──────────────────────────────────────────────────

/**
 * Transfer money from your wallet to a bank account.
 * Minimum: UGX 50,000.
 */
export async function initiateBankTransfer(params: {
  bankId:        number;
  accountName:   string;
  accountNumber: string;
  amount:        number;
  reason:        string;
  transferId:    string;
}): Promise<SsentezoActionResult<{ reference: string; status: TransactionStatus }>> {
  return withSsentezo(async () => {
    const result = await wallet.bankTransfer.requestTransfer({
      externalReference: generatePrefixedReference(`bank_${params.transferId}`),
      bankId:            params.bankId,
      accountName:       params.accountName,
      accountNumber:     params.accountNumber,
      amount:            params.amount,
      reason:            params.reason,
    });
    return { reference: result.externalReference, status: result.transactionStatus };
  });
}
