import { processPendingOutboxTasks } from "@/lib/actions/outbox";
import { NextRequest, NextResponse } from "next/server";

/**
 * `GET /api/cron/outbox` or `POST /api/cron/outbox`
 * Periodic cron worker endpoint to sweep and process pending/retryable outbox tasks.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET; 
  // If CRON_SECRET is configured, enforce Bearer token verification
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleOutboxCron(req);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is configured, enforce Bearer token verification
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
    
  return handleOutboxCron(req);
}

async function handleOutboxCron(req: NextRequest) {
  try {
   
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    const result = await processPendingOutboxTasks(limit);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[Cron Outbox] Error handling outbox cron job:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error processing outbox",
      },
      { status: 500 }
    );
  }
}
