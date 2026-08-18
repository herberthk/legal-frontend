
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from '@/constants';
import { db } from '@/firebase/admin';
import { createNotification, sendTransactionReceiptEmail } from '@/lib';
import { verifyPawaPayCallback } from '@/sdk/verify';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

// ── Webhook callback ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { valid, body, error } = await verifyPawaPayCallback(req);

  if (!valid) {
    console.error('[pawaPay callback] Verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const cb = body as DepositPayLoad;
  if (!cb.depositId) {
    return NextResponse.json({ error: 'Invalid deposit ID' }, { status: 400 });
  }
  const { depositId: externalReference, status, providerTransactionId, country } = cb;

  // Extract baseAmount from metadata object (provided as string, e.g. "190000")
  const amountUGX = Number((cb.metadata)?.baseAmount) || 0;

  try {
    const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc(externalReference);

    let alreadyProcessed = false;
    let notFound = false;
    let newBalance = 0;
    let userId = "";
    let amount = 0;
    let method = "";

    await db.runTransaction(async (transaction) => {
      const txSnap = await transaction.get(txRef);
      if (!txSnap.exists) {
        notFound = true;
        return;
      }

      const txData = txSnap.data() as Transaction & { idempotencyKey?: string };
      userId = txData.userId;
      amount = txData.amount;
      method = txData.method;
      const idempotencyKey = txData.idempotencyKey;

      let claimRef: FirebaseFirestore.DocumentReference | null = null;
      if (idempotencyKey) {
        const claimDocId = Buffer.from(`${userId}:${idempotencyKey}`).toString("base64url");
        claimRef = db.collection(COLLECTIONS.IDEMPOTENCY_CLAIMS).doc(claimDocId);
        const claimSnap = await transaction.get(claimRef);
        if (claimSnap.exists) {
          const claimData = claimSnap.data();
          if (claimData?.status === "COMPLETED" || claimData?.status === "FAILED") {
            alreadyProcessed = true;
            return;
          }
        }
      }

      // Check transaction doc status as well
      if (txData.status === "COMPLETED" || txData.status === "FAILED") {
        alreadyProcessed = true;
        return;
      }

      if (status === "COMPLETED") {
        const creditAmount = Math.round((amountUGX / USD_TO_UGX_EXCHANGE_RATE) * 100);
        const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
        const userSnap = await transaction.get(userRef);
        const currentBalance = userSnap.data()?.balance || 0;
        newBalance = currentBalance + creditAmount;

        transaction.update(txRef, { status: "COMPLETED", providerTransactionId, country });
        transaction.update(userRef, { balance: newBalance });

        if (claimRef) {
          transaction.set(claimRef, { status: "COMPLETED" }, { merge: true });
        }
      } else if (status === "FAILED") {
        transaction.update(txRef, { status: "FAILED", providerTransactionId, country });
        if (claimRef) {
          transaction.set(claimRef, { status: "FAILED" }, { merge: true });
        }
      }

      // Record in PROCCESSED_TRANSACTIONS atomically within the transaction
      const processedRef = db.collection(COLLECTIONS.PROCCESSED_TRANSACTIONS).doc(externalReference);
      transaction.set(processedRef, {
        reference: externalReference,
        status,
        userId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (notFound) {
      console.warn(`[pawaPay callback] No transaction found for ref: ${externalReference}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (alreadyProcessed) {
      console.log(`[pawaPay callback] Transaction ${externalReference} already processed`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentMethodLabel = method === "MTN" ? "MTN Mobile Money" : "Airtel Money";

    if (status === "COMPLETED") {
      // Non-blocking side-effects (fire and forget)
      Promise.all([
        sendTransactionReceiptEmail({
          userId,
          amountInCents: amount,
          paymentMethod: paymentMethodLabel,
          reference: externalReference,
          newBalanceInCents: newBalance,
          transactionId: externalReference,
        }),
        createNotification(userId, {
          title: "Deposit Successful",
          message: `Your Mobile Money deposit of UGX ${(amountUGX).toLocaleString("en-UG")} was successful.`,
          type: "SUCCESS",
          url: "/dashboard/billing",
        }),
      ]).catch((err) =>
        console.error("[pawaPay callback] Side-effect error:", err)
      );
    } else if (status === "FAILED") {
      createNotification(userId, {
        title: "Deposit Failed",
        message: "Your Mobile Money deposit could not be completed. Please try again.",
        type: "ERROR",
        url: "/dashboard/billing/checkout",
      }).catch((err) =>
        console.error("[pawaPay callback] Failed notification error:", err)
      );
    }
  } catch (dbErr) {
    // Log but still return 200 — never let DB errors cause PawaPay retry loops
    console.error("[pawaPay callback] DB update failed:", dbErr);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}