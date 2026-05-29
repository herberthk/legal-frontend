import { parseCallbackPayload } from "@/lib/ssentezo";
import { NextRequest, NextResponse } from "next/server";

// POST /api/payments/callback
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = parseCallbackPayload(await req.json().catch(() => null));

    if (!payload) {
      console.warn("[Ssentezo callback] Unexpected payload shape");
      return NextResponse.json({ received: true });
    }

    const { transactionStatus, externalReference, financialTransactionId } = payload;
    console.log("[Ssentezo] received callback", payload);

    try {
      if (transactionStatus === "SUCCEEDED") {
        // TODO: update order in DB
        console.log(`[Ssentezo] Succeeded: ${externalReference}`);
      } else {
        // TODO: update order in DB for failure
        console.log(`[Ssentezo] Failed: ${externalReference}`);
      }
    } catch (dbErr) {
      console.error("[Ssentezo callback] DB update failed:", dbErr);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Ssentezo callback] Error:", err);
    return NextResponse.json({ received: true });
    // return Ne handleSsentezoRouteError(err, NextResponse);
  }
}