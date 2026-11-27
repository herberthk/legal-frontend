import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/actions/auth";
import { triggerMultiplePushNotifications } from "@/lib/push-notifications";

const BodySchema = z
  .object({
    userIds: z.array(z.string().min(1)).max(5000).optional(),
    excludeUserId: z.string().min(1).optional(),
    broadcast: z.boolean().optional(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000).optional(),
    message: z.string().min(1).max(1000).optional(),
    url: z.string().min(1).optional(),
    link: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]).optional(),
    data: z.record(z.string(), z.string()).optional(),
    saveToInbox: z.boolean().optional(),
    dedupeKey: z.string().min(1).max(256).optional(),
  })
  .refine((val) => Boolean(val.message || val.body), {
    message: "Missing message/body",
  })
  .refine(
    (val) => Boolean(val.userIds?.length || val.broadcast),
    { message: "Provide userIds or broadcast: true" },
  );

/**
 * POST /api/notifications/multiple-push
 *
 * Admin-only endpoint delegating multi-recipient push delivery to the
 * Firebase Cloud Functions backend.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { body, message, url, link, ...rest } = parsed.data;
    const result = await triggerMultiplePushNotifications({
      ...rest,
      message: (message ?? body)!,
      link: link ?? url ?? "/notifications",
    });

    return NextResponse.json({
      success: result.success,
      sent: result.sent ?? 0,
      failed: result.failed ?? 0,
      deduplicated: result.deduplicated ?? false,
    });
  } catch (error) {
    console.error("[FCM] Error in /api/notifications/multiple-push:", error);
    return NextResponse.json(
      { error: "Failed to send push notification" },
      { status: 500 },
    );
  }
}
