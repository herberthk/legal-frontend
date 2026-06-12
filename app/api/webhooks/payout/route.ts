
import { verifyPawaPayCallback } from '@/sdk/verify';
import { NextRequest, NextResponse } from 'next/server';

// ── Webhook callback ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { valid, body, error } = await verifyPawaPayCallback(req);

  if (!valid) {
    console.error('[pawaPay callback] Verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

   

  const cb = body as PayoutPayLoad;
console.log( 'payout body', cb);

  return NextResponse.json({}, { status: 200 });
}

// payout body {
//   amount: '170000.00',
//   country: 'UGA',
//   created: '2026-06-12T15:23:40Z',
//   currency: 'UGX',
//   customerMessage: 'Payout Request',
//   payoutId: 'ccf73261-dec0-46d2-9e0c-cb3706370c74',
//   providerTransactionId: 'CI210729.1311.C00007',
//   recipient: {
//     accountDetails: { phoneNumber: '256700123456', provider: 'AIRTEL_OAPI_UGA' },
//     type: 'MMO'
//   },
//   status: 'COMPLETED'
// }