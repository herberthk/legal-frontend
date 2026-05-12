"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getFCMToken } from "@/firebase/client";
import { onMessage, Unsubscribe } from "firebase/messaging";
import { saveFCMToken } from "@/lib/actions/notifications";
import { useAuthStore } from "@/store";
import { messaging } from "@/firebase/client";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface UseFCMReturn {
  permission: PermissionState;
  isSupported: boolean;
  token: string | null;
  showSoftPrompt: boolean;
  requestPermission: () => Promise<void>;
  dismissSoftPrompt: () => void;
}

/**
 * Initialises Firebase Cloud Messaging for the current authenticated user.
 *
 * - Requests notification permission on mount (after a short delay so it
 *   doesn't block the initial render).
 * - Fetches and persists the FCM registration token to Firestore so the
 *   server can fan-out push messages to the user's devices.
 * - Sets up an `onMessage` listener to surface foreground push payloads
 *   as Sonner toasts (background payloads are handled by the SW).
 * - Re-fetches the token whenever the user signs in/out.
 */
export function useFCMPushNotifications(): UseFCMReturn {
  const userId = useAuthStore((s) => s.user?.id);

  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Track the last token we saved so we don't double-write on re-renders
  const savedTokenRef = useRef<string | null>(null);

  const [showSoftPrompt, setShowSoftPrompt] = useState(false);

  // ── Detect support ────────────────────────────────────────────────────────
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission as PermissionState);
    } else {
      setPermission("unsupported");
    }
  }, []);

  // ── Request permission + fetch token ──────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!isSupported || !userId) return;

    setShowSoftPrompt(false);

    const fcmToken = await getFCMToken();
    const newPermission = Notification.permission as PermissionState;
    setPermission(newPermission);

    if (fcmToken && fcmToken !== savedTokenRef.current) {
      setToken(fcmToken);
      savedTokenRef.current = fcmToken;
      // Persist token server-side (fire-and-forget; non-critical)
      saveFCMToken(userId, fcmToken).catch((err) =>
        console.error("[FCM] Failed to save token:", err),
      );
    }
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
  // Instead of automatically requesting native permission on mount, we show
  // a soft prompt after 2 minutes of active session if they are still "default".
  useEffect(() => {
    if (!isSupported || !userId || permission !== "default") return;

    // Check if previously dismissed recently (e.g. within last 24h)
    const dismissedAt = localStorage.getItem("fcm_soft_prompt_dismissed_at");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneDay) {
        return; // Don't show again today
      }
    }

    const timer = setTimeout(() => {
      // Check permission again just in case it changed
      if (Notification.permission === "default") {
        setShowSoftPrompt(true);
      }
    }, 120000); // 2 minutes

    return () => clearTimeout(timer);
  }, [isSupported, userId, permission]);

  // ── Silent Token Renewal ──────────────────────────────────────────────────
  // If permission is already "granted", silently fetch and save the token
  // on mount. This ensures tokens are synced to the database (and refreshed if
  // necessary) without showing the soft prompt.
  useEffect(() => {
    if (isSupported && userId && Notification.permission === "granted") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      requestPermission();
    }
  }, [isSupported, userId, requestPermission]);

  useEffect(() => {
    const setupListener = async () => {
      if (!token) return; // Exit if no token is available.

      const m = await messaging();
      if (!m) return;

      // Step 9: Register a listener for incoming FCM messages.
      const unsubscribe = onMessage(m, (payload) => {
        console.log("Foreground push notification received:", payload);
        if (Notification.permission !== "granted") return;

        const link = payload.fcmOptions?.link || payload.data?.link;

        if (link) {
          toast.info(payload.notification?.title, {
            description: payload.notification?.body,
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
                const link = payload.fcmOptions?.link || payload.data?.link;
                if (link) {
                  window.open(link, "_self");
                }
              },
            },
          });
        } else {
          toast.info(payload.notification?.title, {
            description: payload.notification?.body,
            duration: 6000,
            style: {
              background: "#09172b",
              border: "0.5px solid white",
              borderRadius: "12px",
            },
          });
        }

        // --------------------------------------------
        // Disable this if you only want toast notifications.
        // Vibrate the device manually in the foreground if supported
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }

        const n = new Notification(
          payload.notification?.title || "Legal Adviser",
          {
            body: payload.notification?.body || "New update received",
            icon: "/icons/apple-icon-180.png",
            badge: "/icons/mstile-icon-128.png",
            data: link ? { url: link } : undefined,
            tag: "legal-adviser-push",
          },
        );

        // Step 10: Handle notification click event to navigate to a link if present.
        n.onclick = (event) => {
          event.preventDefault();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const link = (event.target as any)?.data?.url;
          if (link) {
            window.open(link, "_self");
          }
        };
        // --------------------------------------------
      });

      return unsubscribe;
    };

    let unsubscribe: Unsubscribe | null = null;

    setupListener().then((unsub) => {
      if (unsub) {
        unsubscribe = unsub;
      }
    });

    // Step 11: Cleanup the listener when the component unmounts.
    return () => unsubscribe?.();
  }, [token]);

  return {
    permission,
    isSupported,
    token,
    showSoftPrompt,
    requestPermission,
    dismissSoftPrompt,
  };
}
