
import { COLLECTIONS } from "@/constants";
import { db } from "@/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<Response> {
  const { reference } = await params;

  try {
    const status = await db
      .collection(COLLECTIONS.TRANSACTIONS)
      .doc(reference)
      .get();
    const txData = status.data() as Transaction;
    console.log("status",txData)
    return NextResponse.json({
      status:    txData?.status,
      amount:    txData?.amount,
    });
  } catch (err) {
    console.error("[Status Route] Error in GET /api/payments/status/[reference]:", err);
    return NextResponse.json({ status: "ERROR",amount:0 });
  }
}