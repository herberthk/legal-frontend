import { parseCallbackPayload } from "@/sdk/ssentezo";
import { db } from "@/firebase/admin";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { sendTransactionReceiptEmail } from "@/lib/actions/email";
import { createNotification } from "@/lib/actions/notifications";
import { revalidatePath } from "next/cache";

// POST /api/payments/callback
// ⚠️  Must be: public (no auth), respond < 5 s, always return HTTP 200
export async function POST(req: NextRequest): Promise<Response> {
  let payload = null;

  try {
    payload = parseCallbackPayload(await req.json().catch(() => null));
  } catch {
    return NextResponse.json({ received: true });
  }

  if (!payload) {
    console.warn("[Ssentezo callback] Unexpected payload shape — ignoring");
    return NextResponse.json({ received: true });
  }

  const { transactionStatus, externalReference } = payload;
  console.log("[Ssentezo] callback received", { transactionStatus, externalReference });

  try {
    // Locate the pre-created Firestore record by externalReference
    const snapshot = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .where("reference", "==", externalReference)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.warn(`[Ssentezo callback] No transaction found for ref: ${externalReference}`);
      return NextResponse.json({ received: true });
    }

    const txDoc = snapshot.docs[0];
    const txData = txDoc.data();
    const { userId, amount, method } = txData;

    if (transactionStatus === "SUCCEEDED") {
      // Atomically: mark completed + credit user balance (USD cents)
      const batch = db.batch();
      batch.update(txDoc.ref, { status: "completed" });
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      // const creditAmount = amountUsd ?? Math.round((amountUgx / USD_TO_UGX_EXCHANGE_RATE) * 100);
      batch.update(userRef, { balance: FieldValue.increment(amount) });
      await batch.commit();

      // Fetch updated balance for the receipt email
      const updatedUser = await userRef.get();
      const newBalance: number = updatedUser.data()?.balance ?? 0;

      const paymentMethodLabel =
        method === "MTN" ? "MTN Mobile Money" : "Airtel Money";

        const amountUGX = (Number(amount)/100) * USD_TO_UGX_EXCHANGE_RATE;
      // Non-blocking side-effects (fire and forget — callback must respond fast)
      Promise.all([
        sendTransactionReceiptEmail({
          userId,
          amountInCents: amount,
          paymentMethod: paymentMethodLabel,
          reference: externalReference,
          newBalanceInCents: newBalance,
          transactionId: txDoc.id,
        }),
        createNotification(userId, {
          title: "Deposit Successful",
          message: `Your Mobile Money deposit of UGX ${(amountUGX).toLocaleString("en-UG")} was successful.`,
          type: "SUCCESS",
          url: "/dashboard/billing",
        }),
      ]).catch((err) =>
        console.error("[Ssentezo callback] Side-effect error:", err)
      );

      revalidatePath("/dashboard/billing");
    } else if (transactionStatus === "FAILED") {
      await txDoc.ref.update({ status: "failed" });

      createNotification(userId, {
        title: "Deposit Failed",
        message: "Your Mobile Money deposit could not be completed. Please try again.",
        type: "ERROR",
        url: "/dashboard/billing/checkout",
      }).catch((err) =>
        console.error("[Ssentezo callback] Failed notification error:", err)
      );
    }
    // INDETERMINATE: leave as "pending" — can resolve within 48 h
  } catch (dbErr) {
    // Log but still return 200 — never let our DB errors cause Ssentezo retries
    console.error("[Ssentezo callback] DB update failed:", dbErr);
  }

  return NextResponse.json({ received: true });
}