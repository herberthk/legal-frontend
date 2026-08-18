import crypto from "crypto";
import { processPendingOutboxTasks } from "@/lib/actions/outbox";
import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the authorization header against CRON_SECRET using timing-safe comparison.
 * Strictly rejects when CRON_SECRET is not configured in the environment.
 */
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    console.error("[Cron Outbox] Request rejected: CRON_SECRET environment variable is not configured");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authHeader.slice(7);
  const tokenBuffer = Buffer.from(providedToken);
  const secretBuffer = Buffer.from(cronSecret);

  if (tokenBuffer.length !== secretBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
}

/**
 * `GET /api/cron/outbox` or `POST /api/cron/outbox`
 * Periodic cron worker endpoint to sweep and process pending/retryable outbox tasks.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleOutboxCron(req);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleOutboxCron(req);
}

async function handleOutboxCron(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : Number.NaN;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 20;

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
