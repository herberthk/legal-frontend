import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/actions/auth";
import {
  checkWebPushUserRateLimit,
  triggerSinglePushNotification,
} from "@/lib/push-notifications";

const BodySchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  link: z.string().min(1).default("/notifications"),
  imageUrl: z.string().url().optional(),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]).optional(),
  data: z.record(z.string(), z.string()).optional(),
  saveToInbox: z.boolean().optional(),
  dedupeKey: z.string().min(1).max(256).optional(),
});

/**
 * POST /api/notifications/single-push
 *
 * Authenticated wrapper delegating single-recipient push delivery to the
 * Firebase Cloud Functions backend. Non-admins may only notify themselves.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { userId, ...rest } = parsed.data;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (user.id !== userId && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isAdmin && !checkWebPushUserRateLimit(user.id)) {
      return NextResponse.json(
        { error: "Too many push requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const result = await triggerSinglePushNotification({
      to: userId,
      ...rest,
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      devices: result.sent ?? 0,
      deduplicated: result.deduplicated ?? false,
    });
  } catch (error) {
    console.error("[FCM] Error in /api/notifications/single-push:", error);
    return NextResponse.json(
      { error: "Failed to send push notification" },
      { status: 500 },
    );
  }
}
