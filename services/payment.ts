import "server-only";

import { db } from "@/firebase/admin";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

import { parseUgandanNumber } from "@/utils";
import { customPawapayError } from "@/sdk/error";
import {
  pawapay,
  TransactionStatus,
  PawaPayApiError,
  PawaPayNetworkError,
  PawaPayValidationError,
} from "@/sdk";

/**
 * Uid-parameterized core of the mobile-money deposit flow.
 *
 * `userId` is a REQUIRED argument and is treated as already trusted — the caller
 * is responsible for proving identity before calling:
 *   - web  → `initiateCheckoutPayment` in `lib/actions/payment/index.ts` resolves
 *            the `session` cookie and passes the verified uid down.
 *   - mobile → `app/api/v1/payments/momo/deposit/route.ts` resolves the Firebase
 *            ID token via `requireMobileAuth` and passes `gate.userId` down.
 *
 * This module is deliberately NOT a `"use server"` file, so it is never exposed
 * as a browser-callable server action. A `userId` accepted straight off the wire
 * would let any caller credit/charge an arbitrary account.
 *
 * Mirrors the `lib/actions/transcribe.ts` → `services/transcribe.ts` split.
 */
export type InitiateDepositParams = {
  userId: string;
  msisdn: string;
  amount?: number;
  amountUgx?: number;
  userName?: string;
  idempotencyKey: string;
};

export type InitiateDepositResult =
  | {
      success: true;
      data: {
        reference: string;
        transactionId: string;
        status: TransactionStatus | string;
      };
    }
  | { success: false; error: string; terminal?: boolean };

export const initiateDeposit = async (
  params: InitiateDepositParams,
): Promise<InitiateDepositResult> => {
  try {
    const userId = params.userId;
    if (!userId) {
      return { success: false, error: "Unauthorized caller", terminal: true };
    }

    if (
      !params.idempotencyKey ||
      typeof params.idempotencyKey !== "string" ||
      params.idempotencyKey.trim().length === 0 ||
      params.idempotencyKey.length > 128
    ) {
      return { success: false, error: "idempotencyKey is required (max 128 characters)", terminal: true };
    }
    const idempotencyKey = params.idempotencyKey.trim();

    const rawAmount = params.amount ?? params.amountUgx;
    if (!rawAmount || typeof rawAmount !== "number" || rawAmount < 1000 || rawAmount > 7_000_000) {
      return { success: false, error: "Invalid payment amount. Must be between 1,000 and 7,000,000 UGX", terminal: true };
    }
    const amountUgx = Math.round(rawAmount);

    // Derive USD amount strictly using trusted server exchange rate
    const amountUsd = Number((amountUgx / USD_TO_UGX_EXCHANGE_RATE).toFixed(4));
    const { provider } = parseUgandanNumber(params.msisdn);
    const method: TransactionMethod = provider === "MTN" ? "MTN" : "AIRTEL";
    const feeResult = pawapay.calculateFee(amountUgx);
    const total = amountUgx + feeResult.fee;

    // Deterministic external reference
    const generatedReference = pawapay.deposits.generateId();

    // Safe base64url document ID for the idempotency claim
    const claimDocId = Buffer.from(`${userId}:${idempotencyKey}`).toString("base64url");

    // Perform atomic idempotency claim via Firestore transaction
    type ClaimResult =
      | { isExisting: true; success: true; data: { reference: string; transactionId: string; status: TransactionStatus | string } }
      | { isExisting: true; success: false; error: string; terminal?: boolean }
      | { isExisting: false; externalReference: string; transactionRef: FirebaseFirestore.DocumentReference; claimRef: FirebaseFirestore.DocumentReference };

    const claimResult: ClaimResult = await db.runTransaction(async (transaction) => {
      const claimRef = db.collection(COLLECTIONS.IDEMPOTENCY_CLAIMS).doc(claimDocId);
      const claimSnap = await transaction.get(claimRef);

      if (claimSnap.exists) {
        const claimData = claimSnap.data() as {
          transactionId: string;
          reference: string;
          status: "PENDING" | "COMPLETED" | "FAILED" | "ACCEPTED" | string;
        };

        if (claimData.status === "FAILED") {
          return {
            isExisting: true,
            success: false,
            error: "Previous payment attempt with this key has failed. Please start a new payment.",
            terminal: true,
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
        userId,
        type: "DEPOSIT",
        description: `Funds Deposit via Mobile Money (${method})`,
        amount: amountUsd * 100,
        createdAt: FieldValue.serverTimestamp(),
        details: `Phone: ${params.msisdn}`,
        reference: generatedReference,
        status: "PENDING",
        fee: feeResult.fee,
        method,
        idempotencyKey,
      };

      transaction.set(transactionRef, txData);
      transaction.set(claimRef, {
        userId,
        idempotencyKey,
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
    });

    if (claimResult.isExisting) {
      return claimResult;
    }

    const { externalReference, transactionRef, claimRef } = claimResult;

    let result;
    try {
      result = await pawapay.deposits.initiate({
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
    } catch (apiErr) {
      console.error("[initiateDeposit] Provider initiate error:", apiErr);
      customPawapayError(apiErr);

      if (apiErr instanceof PawaPayValidationError) {
        // Confirmed client-side validation error — payment was never sent to provider
        await Promise.allSettled([
          transactionRef.update({ status: "FAILED" }),
          claimRef.update({ status: "FAILED" }),
        ]);
        return {
          success: false,
          error: apiErr.message || "Invalid payment request",
          terminal: true,
        };
      }

      if (apiErr instanceof PawaPayNetworkError) {
        // Network timeout/failure: status is uncertain. Attempt reconciliation.
        try {
          const statusRes = await pawapay.deposits.checkStatus(externalReference);
          if (statusRes.status === "ACCEPTED" || statusRes.status === "COMPLETED") {
            return {
              success: true,
              data: {
                reference: statusRes.depositId,
                transactionId: transactionRef.id,
                status: statusRes.status,
              },
            };
          }
          if (statusRes.status === "REJECTED" || statusRes.status === "FAILED") {
            await Promise.allSettled([
              transactionRef.update({ status: "FAILED" }),
              claimRef.update({ status: "FAILED" }),
            ]);
            return {
              success: false,
              error: "Payment was rejected by provider",
              terminal: true,
            };
          }
        } catch {
          // Status check failed or still pending — keep records PENDING
        }

        return {
          success: false,
          error: "Network timeout communicating with payment provider. Please check your phone or retry.",
          terminal: false,
        };
      }

      if (apiErr instanceof PawaPayApiError) {
        if (apiErr.isRateLimitError || apiErr.isAuthError) {
          // Never reached provider processing, or a server-side credential fault.
          // Keep records PENDING so the same idempotency key can be retried.
          return {
            success: false,
            error: "Payment provider is temporarily unavailable. Please try again in a moment.",
            terminal: false,
          };
        }

        if (apiErr.httpStatus >= 400 && apiErr.httpStatus < 500) {
          // Definitive client error from API
          await Promise.allSettled([
            transactionRef.update({ status: "FAILED" }),
            claimRef.update({ status: "FAILED" }),
          ]);
          return {
            success: false,
            error: apiErr.failureMessage || apiErr.message || "Payment was rejected by provider",
            terminal: true,
          };
        }

        // 5xx provider server error: status is uncertain
        return {
          success: false,
          error: "Payment provider is temporarily unavailable. Please try again in a moment.",
          terminal: false,
        };
      }

      return {
        success: false,
        error: "Failed to initiate payment. Please retry.",
        terminal: false,
      };
    }

    if (result.status !== 'ACCEPTED') {
      await Promise.allSettled([
        transactionRef.update({ status: "FAILED" }),
        claimRef.update({ status: "FAILED" }),
      ]);

      return {
        success: false,
        error: "Failed to initiate payment, Try again",
        terminal: true,
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
    console.error("initiateDeposit error:", err);
    customPawapayError(err);
    return { success: false, error: "Failed to initiate payment", terminal: false };
  }
};
