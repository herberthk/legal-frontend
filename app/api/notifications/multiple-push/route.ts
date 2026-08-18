import { NextResponse } from "next/server";
import { db, messaging } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { getCurrentUser } from "@/lib/actions/auth";
import { MulticastMessage } from "firebase-admin/messaging";
import { getFCMTokenDocId } from "@/lib/fcm-utils";

type SendPushBody = {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
};

/**
 * POST /api/notifications/send-push
 *
 * Sends a Firebase Cloud Messaging push notification to all registered
 * devices of the specified user.
 *
 * - Reads FCM tokens from the top-level `fcmTokens` collection
 * - Uses `sendEachForMulticast` to deliver in parallel
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
    const { userId, title, body: msgBody, url, data } = body;

    if (!userId || !title || !msgBody) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
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
      return NextResponse.json({ success: true, sent: 0 });
    }

    const tokens = tokensSnap.docs.map((d) => d.data().token as string);


    const message: MulticastMessage = {
      tokens,
      notification: { title, body: msgBody },
      data: {
        url: url ?? "/dashboard/voice",
        ...data,
      },
      webpush: {
        fcmOptions: {
          link: url ?? "/dashboard/voice",
        },
        notification: {
          title,
          body: msgBody,
          icon: "/icons/manifest-icon-192.maskable.png",
          badge: "/icons/mstile-icon-128.png",
          requireInteraction: false,
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

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
            db
              .collection(COLLECTIONS.FCM_TOKENS)
              .where("token", "==", rawToken)
              .get()
              .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
              .catch(() => {}),
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
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (error) {
    console.error("[FCM] Error sending push notification:", error);
    return NextResponse.json(
      { error: "Failed to send push notification" },
      { status: 500 },
    );
  }
}
