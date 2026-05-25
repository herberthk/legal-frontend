/**
 * lib/fcm-admin.ts
 *
 * Server-side FCM utility.
 * Reads all stored FCM tokens for a user and delivers a push via
 * firebase-admin Messaging. Stale tokens are cleaned up automatically.
 */

import { COLLECTIONS } from "@/constants";
import { db, messaging } from "@/firebase/admin";

interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to all registered devices of a user.
 * Silently resolves (sends 0) when the user has no stored FCM tokens.
 */
export async function sendPushToUser({
  userId,
  title,
  body,
  url = "/dashboard/voice",
  data,
}: SendPushOptions): Promise<{ sent: number; failed: number }> {
  // Fetch stored FCM tokens for this user
  const tokensSnap = await db
    .collection(COLLECTIONS.FCM_TOKENS)
    .where("userId", "==", userId)
    .get();

  if (tokensSnap.empty) {
    return { sent: 0, failed: 0 };
  }

  const tokens = tokensSnap.docs.map((d) => d.data().token as string);

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url, ...data },
    webpush: {
      fcmOptions: { link: url },
      notification: {
        title,
        body,
        icon: "/icons/manifest-icon-192.maskable.png",
        badge: "/icons/mstile-icon-128.png",
        requireInteraction: false,
      },
    },
  });

  // Remove tokens that FCM rejected (device unregistered / token invalid)
  const staleCleanup: Promise<unknown>[] = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const errCode = res.error?.code ?? "";
      if (
        errCode === "messaging/registration-token-not-registered" ||
        errCode === "messaging/invalid-registration-token"
      ) {
        staleCleanup.push(
          db
            .collection(COLLECTIONS.FCM_TOKENS)
            .doc(tokens[idx])
            .delete()
            .catch(() => {
              /* silently ignore cleanup errors */
            }),
        );
      } else {
        console.error(`[FCM] Delivery failed for token[${idx}]:`, res.error);
      }
    }
  });

  await Promise.allSettled(staleCleanup);

  return {
    sent: response.successCount,
    failed: response.failureCount,
  };
}
