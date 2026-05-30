import { handleSsentezoRouteError } from "@/lib/ssentezo";
import { wallet } from "@/lib/payments";
import { NextRequest, NextResponse } from "next/server";

// GET /api/payments/status/[reference]
// Polled by useTransactionStatus hook on the client
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<Response> {
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
    console.error("[Status Route] Error in GET /api/payments/status/[reference]:", err);
    //@ts-ignore
    return handleSsentezoRouteError(err as Error, NextResponse);
  }
}