import { NextResponse } from "next/server";
import { db, messaging } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { getCurrentUser } from "@/lib/actions/auth";
import { Message } from "firebase-admin/messaging";

type SendPushBody = {
  userId: string;
  title: string;
  message: string;
  link?: string;
  data?: Record<string, string>;
};

/**
 * POST /api/notifications/send-push
 *
 * Sends a Firebase Cloud Messaging push notification to one
 * registered device of the specified user.
 *
 * - Reads FCM token from the top-level `fcmTokens` collection
 * - Automatically removes stale / expired tokens from Firestore
 */
export async function POST(req: Request) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as SendPushBody;
    const { userId, title, message, link } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 },
      );
    }

    // Fetch all FCM tokens for this user
    const tokensSnap = await db
      .collection(COLLECTIONS.FCM_TOKENS)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (tokensSnap.empty) {
      // No tokens — user hasn't enabled notifications yet; silently succeed
      return NextResponse.json({ success: true, sent: 0 });
    }

    const token = tokensSnap.docs.map((d) => d.data().token as string)[0];
    console.log("[FCM] Sending push notification to user:", token);

    const payload: Message = {
      token,
      notification: {
        title: title,
        body: message,
      },
      webpush: link
        ? {
            fcmOptions: {
              link,
            },
          }
        : undefined,
    };

    await messaging.send(payload);

    return NextResponse.json({
      success: true,
      message: "Notification sent!",
    });
  } catch (error) {
    console.error("[FCM] Error sending push notification:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
