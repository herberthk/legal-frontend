// ─────────────────────────────────────────────────────────────────────────────
//  Ssentezo Wallet SDK — Next.js Route Handler Examples
//  Uses handleSsentezoRouteError / withSsentezo to eliminate boilerplate.
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/collect/route.ts
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  getSsentezoWallet,
  generatePrefixedReference,
  handleSsentezoRouteError,
  parseCallbackPayload,
} from "..";

const wallet = getSsentezoWallet();

// POST /api/payments/collect
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { msisdn, amount, reason, orderId } = body as {
    msisdn?: string; amount?: number; reason?: string; orderId?: string;
  };

  if (!msisdn || !amount || !reason || !orderId) {
    return NextResponse.json(
      { error: "msisdn, amount, reason and orderId are required." },
      { status: 400 }
    );
  }

  const externalReference = generatePrefixedReference(`order_${orderId}`);

  try {
    const result = await wallet.transactions.deposit({
      externalReference,
      msisdn,
      amount,
      reason,
      successCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
      failureCallback:  `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
    });

    return NextResponse.json({
      reference: externalReference,
      status:    result.transactionStatus,
      walletRef: result.ssentezoWalletReference,
    });
  } catch (err) {
    // ↓ One line replaces the entire if/instanceof chain
    return handleSsentezoRouteError(err, NextResponse);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/disburse/route.ts
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/payments/disburse
export async function disbursePOST(req: NextRequest) {
  const { msisdn, amount, reason, recipientName, payoutId } = await req.json() as {
    msisdn: string; amount: number; reason: string;
    recipientName?: string; payoutId: string;
  };

  try {
    const verified = await wallet.msisdn.verify(msisdn);
    console.log(`Sending to: ${verified.FirstName} ${verified.Surname}`);
  } catch {
    return NextResponse.json(
      { error: "Could not verify recipient phone number." },
      { status: 422 }
    );
  }

  try {
    const result = await wallet.transactions.withdraw({
      externalReference: generatePrefixedReference(`payout_${payoutId}`),
      msisdn,
      amount,
      reason,
      name: recipientName,
    });

    return NextResponse.json({ status: result.transactionStatus });
  } catch (err) {
    return handleSsentezoRouteError(err, NextResponse);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/callback/route.ts
// Must be public (no auth), must respond < 5 s, always return HTTP 200.
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/payments/callback
export async function callbackPOST(req: NextRequest) {
  const payload = parseCallbackPayload(await req.json().catch(() => null));

  if (!payload) {
    console.warn("[Ssentezo callback] Unexpected payload shape");
    return NextResponse.json({ received: true });
  }

  const { transactionStatus, externalReference, financialTransactionId } = payload;

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


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/status/[reference]/route.ts
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/payments/status/:reference
export async function statusGET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  try {
    const status = await wallet.transactions.getStatus(reference);
    return NextResponse.json({
      status:    status.transactionStatus,
      amount:    status.amount,
      currency:  status.currency,
      timestamp: status.transactionTime,
    });
  } catch (err) {
    return handleSsentezoRouteError(err, NextResponse);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/banks/route.ts
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/payments/banks
export async function banksGET() {
  try {
    const banks = await wallet.bankTransfer.getBanks();
    return NextResponse.json({ banks });
  } catch (err) {
    return handleSsentezoRouteError(err, NextResponse);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/api/payments/bank-transfer/route.ts
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/payments/bank-transfer
export async function bankTransferPOST(req: NextRequest) {
  const { bankId, accountName, accountNumber, amount, reason, transferId } =
    await req.json() as {
      bankId: number; accountName: string; accountNumber: string;
      amount: number; reason: string; transferId: string;
    };

  try {
    const result = await wallet.bankTransfer.requestTransfer({
      externalReference: generatePrefixedReference(`bank_${transferId}`),
      bankId,
      accountName,
      accountNumber,
      amount,
      reason,
    });

    return NextResponse.json({
      reference: result.externalReference,
      status:    result.transactionStatus,
      walletRef: result.ssentezoWalletReference,
    });
  } catch (err) {
    return handleSsentezoRouteError(err, NextResponse);
  }
}
