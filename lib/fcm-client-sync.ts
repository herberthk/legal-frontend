import { getFCMToken, messaging } from "@/firebase/client";
import { removeFCMToken, saveFCMToken } from "@/lib/actions/notifications";
import type { MessagePayload } from "firebase/messaging";

const TOKEN_CACHE_KEY = "fcm_token_cache_v1";

export type FcmPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface FcmClientState {
  permission: FcmPermissionState;
  isSupported: boolean;
  token: string | null;
  error: string | null;
}

let sharedState: FcmClientState = {
  permission: "default",
  isSupported: false,
  token: null,
  error: null,
};

const stateListeners = new Set<() => void>();

export function getFcmClientState(): FcmClientState {
  return sharedState;
}

export function subscribeFcmClientState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function setFcmClientState(patch: Partial<FcmClientState>): void {
  const next: FcmClientState = { ...sharedState, ...patch };
  if (
    next.permission === sharedState.permission &&
    next.isSupported === sharedState.isSupported &&
    next.token === sharedState.token &&
    next.error === sharedState.error
  ) {
    return;
  }
  sharedState = next;
  for (const listener of stateListeners) {
    listener();
  }
}

interface CachedTokenRecord {
  userId: string;
  token: string;
}

export function readCachedWebToken(): CachedTokenRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedTokenRecord>;
    if (
      typeof parsed.userId === "string" &&
      parsed.userId &&
      typeof parsed.token === "string" &&
      parsed.token
    ) {
      return { userId: parsed.userId, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedWebToken(record: CachedTokenRecord | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!record) {
      window.localStorage.removeItem(TOKEN_CACHE_KEY);
    } else {
      window.localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(record));
    }
  } catch {
    // Ignore storage quota / private mode failures
  }
}

/**
 * Syncs the current browser FCM token for `userId` only if it is new or changed.
 * Returns `"unchanged"` without hitting Firestore when the cached pair matches.
 */
export async function syncWebPushToken(
  userId: string,
  fcmToken: string,
): Promise<{ status: "unchanged" | "updated" | "failed" }> {
  if (!userId || !fcmToken) return { status: "failed" };

  const cached = readCachedWebToken();
  if (cached && cached.userId === userId && cached.token === fcmToken) {
    return { status: "unchanged" };
  }

  if (cached && cached.userId === userId && cached.token !== fcmToken) {
    await removeFCMToken(cached.token).catch(() => undefined);
  }

  const res = await saveFCMToken(userId, fcmToken);
  if (!res?.success) {
    return { status: "failed" };
  }

  writeCachedWebToken({ userId, token: fcmToken });
  return { status: "updated" };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

const inFlightWebTokenSync = new Map<string, Promise<string | null>>();
let syncGeneration = 0;

/**
 * Coalesces concurrent permission/token syncs per `userId` across `FCMProvider`
 * and `PermissionsSettings`, and aborts state mutation if sign-out occurred
 * while `getFCMToken()` was in flight.
 */
export async function syncCurrentWebPushToken(
  userId: string,
): Promise<string | null> {
  if (!userId) return null;
  const existing = inFlightWebTokenSync.get(userId);
  if (existing) {
    return existing;
  }

  const gen = syncGeneration;
  const run = (async () => {
    const fcmToken = await getFCMToken();
    if (gen !== syncGeneration) {
      return null;
    }

    const newPermission = Notification.permission as FcmPermissionState;
    setFcmClientState({
      permission: newPermission,
      ...(fcmToken ? { token: fcmToken } : {}),
    });

    if (fcmToken && gen === syncGeneration) {
      await syncWebPushToken(userId, fcmToken).catch((err) =>
        console.error("[FCM] Failed to sync token:", err),
      );
    }
    return fcmToken;
  })();

  inFlightWebTokenSync.set(userId, run);
  try {
    return await run;
  } finally {
    if (inFlightWebTokenSync.get(userId) === run) {
      inFlightWebTokenSync.delete(userId);
    }
  }
}

/**
 * Cleans up a previously cached web token when browser notification permission
 * has been revoked to `"denied"`.
 */
export async function cleanupRevokedWebPushToken(
  userId: string,
): Promise<void> {
  if (!userId) return;
  const cached = readCachedWebToken();
  if (!cached || cached.userId !== userId) return;

  writeCachedWebToken(null);
  setFcmClientState({ token: null });
  await withTimeout(
    removeFCMToken(cached.token).catch(() => undefined),
    2000,
    undefined,
  );
}

/**
 * Best-effort token removal before sign-out while the session cookie is still valid.
 * Bounded by a short timeout so offline sign-out never hangs.
 */
export async function unregisterWebPushToken(timeoutMs = 2000): Promise<void> {
  syncGeneration += 1;
  inFlightWebTokenSync.clear();
  const cached = readCachedWebToken();
  writeCachedWebToken(null);
  setFcmClientState({ token: null });

  let tokenToRemove = cached?.token ?? null;
  if (
    !tokenToRemove &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    tokenToRemove = await withTimeout(
      getFCMToken().catch(() => null),
      1000,
      null,
    );
  }

  if (!tokenToRemove) return;

  await withTimeout(
    removeFCMToken(tokenToRemove).catch(() => undefined),
    timeoutMs,
    undefined,
  );

  try {
    const m = await messaging();
    if (m) {
      const { deleteToken } = await import("firebase/messaging");
      await withTimeout(
        deleteToken(m).catch(() => undefined),
        1000,
        undefined,
      );
    }
  } catch {
    // Best-effort
  }
}

export function resolveForegroundLink(payload: MessagePayload): string | undefined {
  const raw =
    payload.data?.url || payload.data?.link || payload.fcmOptions?.link;
  if (!raw || typeof raw !== "string") return undefined;

  if (typeof window === "undefined") {
    return raw.startsWith("/") ? raw : undefined;
  }

  try {
    const resolved = new URL(raw, window.location.origin);
    if (resolved.origin !== window.location.origin) return undefined;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return undefined;
  }
}
