
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from '@/constants';
import { db } from '@/firebase/admin';
import { createNotification, sendTransactionReceiptEmail } from '@/lib';
import { verifyPawaPayCallback } from '@/sdk/verify';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

// ── Webhook callback ─────────────────────────────────────────────────────────────
// type WebhookResult =
//       | { outcome: "notFound" }
//       | { outcome: "alreadyProcessed" }
//       | {
//           outcome: "processed";
//           userId: string;
//           amount: number;
//           method: string;
//           newBalance: number;
//         };
        
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
  console.log("cb ", cb);
  // The authoritative credit amount is derived from the persisted server-side value after the transaction.
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
        // `amount` is already stored in cents at initiation using the trusted rate.
        const creditAmount = amount;
        if (!Number.isSafeInteger(creditAmount) || creditAmount <= 0) {
          // This is a data-integrity error in our own Firestore record, not a
          // missing-document case. Throw so runTransaction rejects → outer catch
          // returns 500 → PawaPay retries the callback rather than dropping it.
          throw new Error(
            `[pawaPay callback] Invalid persisted amount (${creditAmount}) for ${externalReference}; aborting to trigger provider retry`
          );
        }
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
      try {
        await Promise.all([
          sendTransactionReceiptEmail({
            userId,
            amountInCents: amount,
            paymentMethod: paymentMethodLabel,
            reference: externalReference,
            newBalanceInCents: newBalance,
            transactionId: externalReference,
          }).catch((err) =>
            console.error("[pawaPay callback] Receipt email error:", err)
          ),
          createNotification(userId, {
            title: "Deposit Successful",
            message: `Your Mobile Money deposit of UGX ${Math.round((amount / 100) * USD_TO_UGX_EXCHANGE_RATE).toLocaleString("en-UG")} was successful.`,
            type: "SUCCESS",
            url: "/dashboard/billing",
          }).catch((err) =>
            console.error("[pawaPay callback] Notification error:", err)
          ),
        ]);
      } catch (err) {
        console.error("[pawaPay callback] Side-effect error:", err);
      }
    } else if (status === "FAILED") {
      try {
        await createNotification(userId, {
          title: "Deposit Failed",
          message: "Your Mobile Money deposit could not be completed. Please try again.",
          type: "ERROR",
          url: "/dashboard/billing/checkout",
        });
      } catch (err) {
        console.error("[pawaPay callback] Failed notification error:", err);
      }
    }
  } catch (dbErr) {
    console.error("[pawaPay callback] DB update failed:", dbErr);
    // Processing is idempotent via the atomic transaction and claim checks,
    // so ask the provider to retry rather than dropping the deposit.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
  return NextResponse.json({ received: true }, { status: 200 });
}