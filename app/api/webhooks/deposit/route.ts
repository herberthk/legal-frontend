
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from '@/constants';
import { db } from '@/firebase/admin';
import { createNotification, sendTransactionReceiptEmail } from '@/lib';
import { verifyPawaPayCallback } from '@/sdk/verify';
import { NextRequest, NextResponse } from 'next/server';

// ── Webhook callback ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { valid, body, error } = await verifyPawaPayCallback(req);

  if (!valid) {
    console.error('[pawaPay callback] Verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const cb = body as DepositPayLoad;
  if(!cb.depositId) {
    return NextResponse.json({ error: 'Invalid deposit ID' }, { status: 401 });
  }
  const { depositId: externalReference, status,providerTransactionId,country } = cb;
  // console.log('[pawaPay callback] deposit body', cb);
  // Idempotency check: Ensure we don't process the same transaction twice
  const transaction = await db
    .collection(COLLECTIONS.PROCCESSED_TRANSACTIONS)
    .doc(externalReference)
    .get();

    if(transaction.exists){
      console.log(`[pawaPay callback] Transaction ${externalReference} already processed`);
      return NextResponse.json({ received: true }, { status: 200 });
    }
  // Extract baseAmount from metadata object (provided as string, e.g. "190000")
  const amountUGX = Number((cb.metadata)?.baseAmount) || 0;

  try {
    // Locate the pre-created Firestore record by externalReference
    const snapshot = await db
      .collection(COLLECTIONS.TRANSACTIONS).doc(externalReference)
      .get();

    if (!snapshot.exists) {
      console.warn(`[pawaPay callback] No transaction found for ref: ${externalReference}`);
      return NextResponse.json({ received: true });
    }

    const txData = snapshot.data() as Transaction;
    // console.log("tx data", txData)

    const { userId, amount, method, idempotencyKey } = txData;

    if (status === "COMPLETED") {
      const creditAmount = Math.round((amountUGX / USD_TO_UGX_EXCHANGE_RATE) * 100);
      let newBalance = 0;


      // Atomically check status and credit user balance (USD cents) to prevent race conditions
      await db.runTransaction(async (transaction) => {

        const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
        const userSnap = await transaction.get(userRef);
        const currentBalance = userSnap.data()?.balance || 0;
        newBalance = currentBalance + creditAmount;

        transaction.update(snapshot.ref, { status: "COMPLETED",providerTransactionId,country });
        transaction.update(userRef, { balance: newBalance });

        if (idempotencyKey) {
          const claimDocId = Buffer.from(`${userId}:${idempotencyKey}`).toString("base64url");
          const claimRef = db.collection(COLLECTIONS.IDEMPOTENCY_CLAIMS).doc(claimDocId);
          transaction.set(claimRef, { status: "COMPLETED" }, { merge: true });
        }
      });

      const paymentMethodLabel = method === "MTN" ? "MTN Mobile Money" : "Airtel Money";

      // Non-blocking side-effects (fire and forget — callback must respond fast)
      Promise.all([
        sendTransactionReceiptEmail({
          userId,
          amountInCents: amount,
          paymentMethod: paymentMethodLabel,
          reference: externalReference,
          newBalanceInCents: newBalance,
          transactionId: snapshot.id,
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
      await db.runTransaction(async (transaction) => {
        transaction.update(snapshot.ref, { status: "FAILED", providerTransactionId,country });

        if (idempotencyKey) {
          const claimDocId = Buffer.from(`${userId}:${idempotencyKey}`).toString("base64url");
          const claimRef = db.collection(COLLECTIONS.IDEMPOTENCY_CLAIMS).doc(claimDocId);
          transaction.set(claimRef, { status: "FAILED" }, { merge: true });
        }
      });

      createNotification(userId, {
        title: "Deposit Failed",
        message: "Your Mobile Money deposit could not be completed. Please try again.",
        type: "ERROR",
        url: "/dashboard/billing/checkout",
      }).catch((err) =>
        console.error("[pawaPay callback] Failed notification error:", err)
      );
    }

    // Update user transaction record
      await db.collection(COLLECTIONS.PROCCESSED_TRANSACTIONS).doc(externalReference).set({
        reference: externalReference,
        status: status,
        userId: userId,
        createdAt: new Date().toISOString(),
      });
  
  } catch (dbErr) {
    // Log but still return 200 — never let our DB errors cause pawaPay retries
    console.error("[pawaPay callback] DB update failed:", dbErr);
  }
 
  return NextResponse.json({}, { status: 200 });
}