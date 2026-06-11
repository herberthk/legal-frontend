
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