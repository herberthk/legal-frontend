import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  Analytics,
  logEvent,
} from "firebase/analytics";

import { getStorage } from "firebase/storage";
import {
  getMessaging,
  getToken,
  onMessage,
  MessagePayload,
  isSupported as isMessagingSupported,
} from "firebase/messaging";
import { getFunctions } from "firebase/functions";

import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  AppCheck,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app =
  getApps().find((app) => app.name === "[DEFAULT]") ||
  initializeApp(firebaseConfig, "[DEFAULT]");

// ─── Firebase App Check Initialization ─────────────────────────────────────────
export let appCheck: AppCheck | null = null;

if (typeof window !== "undefined") {
  // Support local development debug tokens
  if (
    (process.env.NEXT_PUBLIC_BUILD_ENVIRONMENT ?? process.env.NODE_ENV) !==
    "production"
  ) {
    const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (debugToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken === "true" ? true : debugToken;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
  }

  const appCheckKey =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY;

  if (appCheckKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn("[AppCheck] Failed to initialize App Check:", err);
    }
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Initialize Functions (Set default region, e.g., europe-west3)
export const functions = getFunctions(app, "europe-west3");

// Safe Analytics initialization — only runs when a valid Measurement ID is
// configured. Without one, getAnalytics loads gtag.js with id=undefined which
// causes a CSP violation and sends malformed data to Google Analytics.
export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? isAnalyticsSupported().then((supported) => (supported ? getAnalytics(app) : null))
    : Promise.resolve(null);

export const logAnalyticsEvent = async (
  eventName: string,
  eventParams?: Record<string, string | number | boolean | undefined>,
) => {
  const analytics = await analyticsPromise;
  if (analytics) {
    logEvent(analytics, eventName, eventParams);
  }
};

export default app;

// ─── Firebase Cloud Messaging ─────────────────────────────────────────────────
export const messaging = async () => {
  const supported = await isMessagingSupported();
  return supported ? getMessaging(app) : null;
};
/**
 * Requests notification permission and returns the FCM registration token.
 * Returns `null` if the user denies permission or FCM is unsupported.
 */
/**
 * Waits for the Serwist service worker to be registered and activated.
 * Returns the active ServiceWorkerRegistration, or null after timeout.
 */
const waitForSwRegistration = async (
  maxWaitMs = 10_000,
): Promise<ServiceWorkerRegistration | null> => {
  const start = Date.now();

  // First, ensure the SW container is ready (any SW controls the page)
  await navigator.serviceWorker.ready;

  // Then verify we can retrieve the specific registration by its scope
  while (Date.now() - start < maxWaitMs) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg?.active) return reg;
    // SW not yet active — wait a bit and retry
    await new Promise((r) => setTimeout(r, 250));
  }

  console.warn("[FCM] Timed out waiting for service worker registration.");
  return null;
};

export const getFCMToken = async (): Promise<string | null> => {
  try {
    const messagingInst = await messaging();
    if (!messagingInst) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set.");
      return null;
    }
    let token: string | null = null;

    try {
      // Wait for the Serwist SW to be fully active before requesting a token.
      // This prevents a race condition where FCMProvider initialises before
      // SerwistProvider has registered the service worker.
      const registration = await waitForSwRegistration();
      if (!registration) {
        console.error("[FCM] No active service worker registration found.");
        return null;
      }
      token = await getToken(messagingInst, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      console.log("[FCM] SW state:", registration.active?.state);
    } catch (error) {
      console.error("[FCM] Failed to get token:", error);
      return null;
    }

    return token ?? null;
  } catch (err) {
    console.error("[FCM] Failed to get token:", err);
    return null;
  }
};

/**
 * Listens for foreground push messages (app is focused).
 * Returns an unsubscribe function.
 */
export const onForegroundMessage = (
  callback: (payload: MessagePayload) => void,
): (() => void) => {
  try {
    const messagingInst = getMessaging(app);
    return onMessage(messagingInst, callback);
  } catch {
    return () => {};
  }
};
