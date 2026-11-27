import "server-only";

import { z } from "zod";
import {
  MULTIPLE_PUSH_NOTIFICATION_URL,
  SINGLE_PUSH_NOTIFICATION_URL,
} from "@/constants";

export type SinglePushPayload = {
  to: string;
  title: string;
  message: string;
  link: string;
  imageUrl?: string;
  type?: NotificationType;
  data?: Record<string, string>;
  saveToInbox?: boolean;
  dedupeKey?: string;
};

export type MultiplePushPayload = {
  userIds?: string[];
  excludeUserId?: string;
  broadcast?: boolean;
  title: string;
  message: string;
  link: string;
  imageUrl?: string;
  type?: NotificationType;
  data?: Record<string, string>;
  saveToInbox?: boolean;
  dedupeKey?: string;
};

const PushResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sent: z.number().optional(),
  failed: z.number().optional(),
  deduplicated: z.boolean().optional(),
});

export type PushDispatchResponse = z.infer<typeof PushResponseSchema>;

const PUSH_TIMEOUT_MS = 12_000;
const WEB_RATE_LIMIT_WINDOW_MS = 60_000;
const WEB_RATE_LIMIT_MAX_REQUESTS = 20;
const WEB_RATE_LIMIT_PRUNE_THRESHOLD = 1000;

const webRateLimitBuckets = new Map<string, number[]>();

export function __resetWebPushRateLimitForTests(): void {
  webRateLimitBuckets.clear();
}

export function checkWebPushUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - WEB_RATE_LIMIT_WINDOW_MS;

  if (webRateLimitBuckets.size > WEB_RATE_LIMIT_PRUNE_THRESHOLD) {
    for (const [key, timestamps] of webRateLimitBuckets.entries()) {
      const last = timestamps[timestamps.length - 1];
      if (last === undefined || last <= windowStart) {
        webRateLimitBuckets.delete(key);
      }
    }
  }

  const recent = (webRateLimitBuckets.get(userId) ?? []).filter(
    (t) => t > windowStart,
  );
  if (recent.length >= WEB_RATE_LIMIT_MAX_REQUESTS) {
    webRateLimitBuckets.set(userId, recent);
    return false;
  }
  recent.push(now);
  webRateLimitBuckets.set(userId, recent);
  return true;
}

async function callPushFunction(
  url: string,
  payload: Record<string, unknown>,
): Promise<PushDispatchResponse> {
  const secret = process.env.PUSH_API_SECRET?.trim();
  if (!secret) {
    throw new Error("PUSH_API_SECRET is not configured on the server.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);

  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-push-secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const errMsg =
      (json as { message?: string } | undefined)?.message ||
      `Push Cloud Function returned HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const parsed = PushResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected response shape from Push Cloud Function.");
  }
  return parsed.data;
}

/**
 * Reusable server-only helper to send a push notification (and optional inbox row)
 * to a single recipient via the Firebase Cloud Functions backend.
 */
export async function triggerSinglePushNotification(
  payload: SinglePushPayload,
): Promise<PushDispatchResponse> {
  return callPushFunction(SINGLE_PUSH_NOTIFICATION_URL, payload);
}

/**
 * Reusable server-only helper to send push notifications to multiple recipients
 * (or broadcast when `broadcast: true`) via the Firebase Cloud Functions backend.
 */
export async function triggerMultiplePushNotifications(
  payload: MultiplePushPayload,
): Promise<PushDispatchResponse> {
  if (!payload.userIds?.length && !payload.broadcast) {
    throw new Error("Provide userIds or broadcast: true.");
  }
  return callPushFunction(MULTIPLE_PUSH_NOTIFICATION_URL, payload);
}
