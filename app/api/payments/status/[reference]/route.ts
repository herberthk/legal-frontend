import { handleSsentezoRouteError } from "@/lib";
import { wallet } from "@/lib/payments";
import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ status: "ERROR", message: handleSsentezoRouteError(err, NextResponse) });
  }
}