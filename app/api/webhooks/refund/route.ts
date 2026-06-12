
import { verifyPawaPayCallback } from '@/sdk/verify';
import { NextRequest, NextResponse } from 'next/server';

// ── Webhook callback ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { valid, body, error } = await verifyPawaPayCallback(req);

  if (!valid) {
    console.error('[pawaPay callback] Verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const cb = body as RefundPayLoad;
  console.log( 'refund body', cb);
  return NextResponse.json({}, { status: 200 });
}

// refund body {
//   amount: '2000.00',
//   country: 'UGA',
//   created: '2026-06-12T15:28:18Z',
//   currency: 'UGX',
//   customerMessage: 'Wallet Topup',
//   providerTransactionId: 'a7a1eb95-d8e1-4061-8ef0-fe66b9ab7dce',
//   recipient: {
//     accountDetails: { phoneNumber: '256779159642', provider: 'MTN_MOMO_UGA' },
//     type: 'MMO'
//   },
//   refundId: 'e7c064b3-8528-4498-adf8-7805a20f426c',
//   status: 'COMPLETED'
// }