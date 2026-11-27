"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { messaging } from "@/firebase/client";
import { onMessage, Unsubscribe } from "firebase/messaging";
import {
  cleanupRevokedWebPushToken,
  getFcmClientState,
  resolveForegroundLink,
  setFcmClientState,
  subscribeFcmClientState,
  syncCurrentWebPushToken,
  type FcmPermissionState,
} from "@/lib/fcm-client-sync";
import { useAuthStore } from "@/store";

interface UseFCMOptions {
  /** Only the root `FCMProvider` mounts the foreground `onMessage` listener. */
  mountListener?: boolean;
}

interface UseFCMReturn {
  permission: FcmPermissionState;
  isSupported: boolean;
  token: string | null;
  error: string | null;
  showSoftPrompt: boolean;
  requestPermission: () => Promise<void>;
  dismissSoftPrompt: () => void;
}

/**
 * Initialises Firebase Cloud Messaging for the current authenticated user.
 *
 * - Shares `{ permission, isSupported, token, error }` across all hook consumers
 *   so granting permission in Settings immediately activates `FCMProvider`'s listener.
 * - Syncs the FCM registration token only when it changes for the current user.
 * - Surfaces a soft prompt after 2 minutes when permission is `"default"`.
 */
export function useFCMPushNotifications(
  options: UseFCMOptions = {},
): UseFCMReturn {
  const { mountListener = false } = options;
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { permission, isSupported, token, error } = useSyncExternalStore(
    subscribeFcmClientState,
    getFcmClientState,
    getFcmClientState,
  );
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);

  // ── Detect support ────────────────────────────────────────────────────────
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setFcmClientState({
      isSupported: supported,
      permission: supported
        ? (Notification.permission as FcmPermissionState)
        : "unsupported",
    });
  }, []);

  // ── Request permission + fetch token ──────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!isSupported || !userId) return;
    setShowSoftPrompt(false);
    await syncCurrentWebPushToken(userId);
  }, [isSupported, userId]);

  const dismissSoftPrompt = useCallback(() => {
    setShowSoftPrompt(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "fcm_soft_prompt_dismissed_at",
        Date.now().toString(),
      );
    }
  }, []);

  // ── Soft Prompt Logic (2 minutes) ─────────────────────────────────────────
  useEffect(() => {
    if (!mountListener || !isSupported || !userId || permission !== "default") {
      return;
    }

    const dismissedAt = localStorage.getItem("fcm_soft_prompt_dismissed_at");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneDay) {
        return;
      }
    }

    const timer = setTimeout(() => {
      if (Notification.permission === "default") {
        setShowSoftPrompt(true);
      }
    }, 120000);

    return () => clearTimeout(timer);
  }, [mountListener, isSupported, userId, permission]);

  // ── Silent Token Sync on Mount / Auth Change ──────────────────────────────
  useEffect(() => {
    if (!mountListener || !isSupported || !userId) return;
    if (Notification.permission === "granted") {
      void syncCurrentWebPushToken(userId);
    } else if (Notification.permission === "denied") {
      void cleanupRevokedWebPushToken(userId);
    }
  }, [mountListener, isSupported, userId]);

  // ── Single Foreground Message Listener ────────────────────────────────────
  useEffect(() => {
    if (!mountListener || !token) return;

    let isMounted = true;
    let unsubscribe: Unsubscribe | null = null;

    const setupListener = async () => {
      try {
        setFcmClientState({ error: null });
        const m = await messaging();
        if (!m) return;

        const unsub = onMessage(m, (payload) => {
          if (Notification.permission !== "granted") return;

          const title =
            payload.notification?.title ??
            payload.data?.title ??
            "Legal Adviser";
          const body =
            payload.notification?.body ??
            payload.data?.body ??
            payload.data?.message;
          const link = resolveForegroundLink(payload);

          if (link) {
            toast.info(title, {
              description: body,
              duration: 10000,
              style: {
                background: "#09172b",
                border: "0.5px dashed white",
                borderRadius: "12px",
              },
              action: {
                label: "View",
                actionButtonStyle: {
                  color: "white",
                  background: "black",
                  padding: "2px",
                  cursor: "pointer",
                },
                onClick: () => {
                  router.push(link);
                },
              },
            });
          } else {
            toast.info(title, {
              description: body,
              duration: 6000,
              style: {
                background: "#09172b",
                border: "0.5px solid white",
                borderRadius: "12px",
              },
            });
          }

          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.([200, 100, 200]);
          }

          window.dispatchEvent(new CustomEvent("fcm:notification-received"));
        });

        if (isMounted) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      } catch (err) {
        console.error("[FCM] Failed to setup foreground listener:", err);
        if (isMounted) {
          setFcmClientState({
            error:
              err instanceof Error
                ? err.message
                : "Failed to setup push notification listener",
          });
        }
      }
    };

    void setupListener();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [mountListener, router, token]);

  return {
    permission,
    isSupported,
    token,
    error,
    showSoftPrompt,
    requestPermission,
    dismissSoftPrompt,
  };
}
