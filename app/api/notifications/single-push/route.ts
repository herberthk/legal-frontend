import { NextResponse } from "next/server";
import { db, messaging } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { getCurrentUser } from "@/lib/actions/auth";
import { MulticastMessage } from "firebase-admin/messaging";
import { getFCMTokenDocId } from "@/lib/fcm-utils";

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

    if (!userId || !title || !message || !link) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body, link" },
        { status: 400 },
      );
    }

    // Fetch all FCM tokens for this user
    const tokensSnap = await db
      .collection(COLLECTIONS.FCM_TOKENS)
      .where("userId", "==", userId)
      .get();

    if (tokensSnap.empty) {
      // No tokens — user hasn't enabled notifications yet; silently succeed
      return NextResponse.json({
        success: false,
        message: "User hasn't enabled notication",
        devices: 0,
      });
    }

    const tokens = tokensSnap.docs.map((d) => d.data().token as string);
    // console.log("[FCM] Sending push notification to user:", tokens);

    const payload: MulticastMessage = {
      tokens,
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

    // await messaging.send(payload);
    const response = await messaging.sendEachForMulticast(payload);

    // Clean up tokens that FCM rejected (device unregistered / token invalid)
    const staleTokenDeletions: Promise<unknown>[] = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const errCode = res.error?.code ?? "";
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          const rawToken = tokens[idx];
          const docId = getFCMTokenDocId(rawToken);
          staleTokenDeletions.push(
            db.collection(COLLECTIONS.FCM_TOKENS).doc(docId).delete().catch(() => {}),
            db.collection(COLLECTIONS.FCM_TOKENS).doc(rawToken).delete().catch(() => {}),
          );
        } else {
          console.error(
            `[FCM] Failed to send to token ${tokens[idx]}:`,
            res.error,
          );
        }
      }
    });

    await Promise.allSettled(staleTokenDeletions);

    return NextResponse.json({
      success: true,
      message: "Notification sent!",
      devices: response.successCount,
    });
  } catch (error) {
    console.error("[FCM] Error sending push notification:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
