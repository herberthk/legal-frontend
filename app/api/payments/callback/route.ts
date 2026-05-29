import { parseCallbackPayload } from "@/lib/ssentezo";
import { NextRequest, NextResponse } from "next/server";

// POST /api/payments/callback
export async function callbackPOST(req: NextRequest) {
  const payload = parseCallbackPayload(await req.json().catch(() => null));

  if (!payload) {
    console.warn("[Ssentezo callback] Unexpected payload shape");
    return NextResponse.json({ received: true });
  }

  const { transactionStatus, externalReference, financialTransactionId } = payload;
console.log("[Ssentezo] received callback", payload);
  try {
    if (transactionStatus === "SUCCEEDED") {
      // await db.order.update({ where: { paymentRef: externalReference }, data: { status: "PAID", providerRef: financialTransactionId } });
      console.log(`[Ssentezo] Succeeded: ${externalReference}`);
    } else {
      // await db.order.update({ where: { paymentRef: externalReference }, data: { status: "PAYMENT_FAILED" } });
      console.log(`[Ssentezo] Failed: ${externalReference}`);
    }
  } catch (dbErr) {
    // Always ack — handle reconciliation in a background job
    console.error("[Ssentezo callback] DB update failed:", dbErr);
  }

  return NextResponse.json({ received: true });
}