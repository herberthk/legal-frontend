import "server-only";

import { triggerSinglePushNotification } from "@/lib/push-notifications";

interface SendPushOptions {
  userId: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}

/**
 * @deprecated Use `triggerSinglePushNotification` from `@/lib/push-notifications` directly.
 * Delegates to the Cloud Functions push backend so there is one delivery source of truth.
 */
export async function sendPushToUser({
  userId,
  title,
  body,
  url = "/dashboard/voice",
  data,
}: SendPushOptions): Promise<{ sent: number; failed: number }> {
  const res = await triggerSinglePushNotification({
    to: userId,
    title,
    message: body,
    link: url,
    data,
    saveToInbox: false,
  });

  return {
    sent: res.sent ?? 0,
    failed: res.failed ?? 0,
  };
}
