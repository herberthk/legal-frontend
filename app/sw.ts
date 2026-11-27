/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { resolveNotificationTargetUrl } from "@/lib/push-url";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// const matchOptions = {
//   ignoreSearch: true,
// } satisfies CacheQueryOptions;

// ─── Firebase Cloud Messaging — Background Push Handler ───────────────────────
let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  if (
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  ) {
    const firebaseApp = initializeApp(firebaseConfig);
    messaging = getMessaging(firebaseApp);
  } else {
    console.warn("[FCM] Missing Firebase public config in service worker.");
  }
} catch (error) {
  console.warn("[FCM] Firebase Cloud Messaging is not supported or failed to initialize:", error);
}

/**
 * Background message handler — fires for data-only background messages when the
 * web app is NOT in focus. When `payload.notification` is present, FCM's SW
 * listener already renders the notification, so we only call `showNotification`
 * here for data-only payloads to avoid duplicate banners.
 */
if (messaging) {
  onBackgroundMessage(messaging, (payload) => {
    if (payload.notification) {
      return;
    }
    const title = payload.data?.title ?? "Legal Adviser";
    const body = payload.data?.body ?? payload.data?.message ?? "";
    const url = payload.data?.url ?? payload.data?.link ?? "/notifications";

    const notificationOptions: NotificationOptions & {
      vibrate?: number[];
      renotify?: boolean;
    } = {
      body,
      icon: "/icons/manifest-icon-192.maskable.png",
      badge: "/icons/mstile-icon-128.png",
      data: { ...(payload.data ?? {}), url },
      vibrate: [200, 100, 200],
      renotify: true,
      tag: "legal-adviser-push",
    };
    return self.registration.showNotification(title, notificationOptions);
  });
}

/** Navigate / focus the app tab when a notification is clicked. */
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetPath = resolveNotificationTargetUrl(
    event.notification.data,
    self.location.origin,
  );
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          const win = client as WindowClient;
          if (win.url.startsWith(self.location.origin) && "focus" in win) {
            await win.focus();
            if ("navigate" in win) {
              return win.navigate(targetUrl);
            }
            return win;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper to determine if a request must bypass the service worker.
 *
 * We bypass all external APIs (Firebase Firestore/Auth, Google/GCM, Stripe) and
 * tracking scripts. If the service worker intercepts these requests (especially
 * long-lived SSE/realtime streams like Firestore channel listeners or tracking domains
 * blocked by browser ad-blockers/ETP), it can cause unexpected errors or performance bottlenecks.
 *
 * By stopping immediate propagation of the fetch event and returning without calling
 * event.respondWith(), we instruct the browser to handle these requests natively.
 */
function shouldBypassServiceWorker(url: URL): boolean {
  const { hostname, pathname } = url;

  // 1. Firebase Auth local proxy path
  if (pathname.startsWith("/__/auth")) {
    return true;
  }

  // 2. Next.js API routes — dynamic backend endpoints (e.g. /api/review, /api/chat, /api/transcribe)
  // must bypass the service worker to prevent fetch watchdog timeouts and multipart stream buffering.
  if (pathname.startsWith("/api/")) {
    return true;
  }

  // 2b. AudioWorklet & voice worker scripts in /public/js — bypass Serwist's
  // StaleWhileRevalidate defaultCache so updated DSP/echo-ducking worklets take
  // effect immediately without serving stale cached scripts.
  if (pathname.startsWith("/js/pcm-")) {
    return true;
  }

  // 3. Google / Firebase APIs & domains
  if (
    hostname === "apis.google.com" ||
    hostname === "www.gstatic.com" ||
    hostname === "accounts.google.com" ||
    hostname === "storage.googleapis.com" ||
    hostname.endsWith(".googleapis.com") ||
    hostname.endsWith(".firebaseio.com") ||
    hostname.endsWith(".firebaseapp.com") ||
    hostname === "www.google.com" ||
    hostname.endsWith(".google.com")
  ) {
    return true;
  }

  // 3. Analytics & Tag Manager
  if (
    hostname === "www.googletagmanager.com" ||
    hostname === "www.google-analytics.com" ||
    hostname === "ssl.google-analytics.com"
  ) {
    return true;
  }

  // 4. Stripe
  if (
    hostname === "js.stripe.com" ||
    hostname === "api.stripe.com"
  ) {
    return true;
  }

  return false;
}

// This listener is registered BEFORE serwist.addEventListeners() so it runs first.
self.addEventListener("fetch", (event: FetchEvent) => {
  try {
    const url = new URL(event.request.url);
    if (shouldBypassServiceWorker(url)) {
      // Stop Serwist from intercepting this fetch event.
      event.stopImmediatePropagation();
      // Delegate to native browser fetching.
      return;
    }
  } catch {
    // Ignore non-absolute URLs (e.g. extension: or blob: schemes).
  }
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true, // Whether the service worker should skip waiting and become the active one.
  clientsClaim: true, // Whether the service worker should claim all clients.
  navigationPreload: true,
  runtimeCaching: defaultCache, // The cache configuration for the service worker.

  fallbacks: {
    // The fallback configuration for the service worker.
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
  precacheOptions: {
    // Whether outdated caches should be removed.
    cleanupOutdatedCaches: true,
    concurrency: 20,
    // ignoreURLParametersMatching: [/.*/],
  },
  // runtimeCaching: [
  //   {
  //     matcher: ({ request, url: { pathname }, sameOrigin }) =>
  //       request.headers.get("RSC") === "1" &&
  //       request.headers.get("Next-Router-Prefetch") === "1" &&
  //       sameOrigin &&
  //       !pathname.startsWith("/api/"),
  //     handler: new NetworkFirst({
  //       cacheName: PAGES_CACHE_NAME.rscPrefetch,
  //       plugins: [
  //         new ExpirationPlugin({
  //           maxEntries: 32,
  //           maxAgeSeconds: 24 * 60 * 60, // 24 hours
  //         }),
  //       ],
  //       matchOptions,
  //     }),
  //   },
  //   {
  //     matcher: ({ request, url: { pathname }, sameOrigin }) =>
  //       request.headers.get("RSC") === "1" &&
  //       sameOrigin &&
  //       !pathname.startsWith("/api/"),
  //     handler: new NetworkFirst({
  //       cacheName: PAGES_CACHE_NAME.rsc,
  //       plugins: [
  //         new ExpirationPlugin({
  //           maxEntries: 32,
  //           maxAgeSeconds: 24 * 60 * 60, // 24 hours
  //         }),
  //       ],
  //       matchOptions,
  //     }),
  //   },
  //   {
  //     matcher: ({ request, url: { pathname }, sameOrigin }) =>
  //       request.headers.get("Content-Type")?.includes("text/html") &&
  //       sameOrigin &&
  //       !pathname.startsWith("/api/"),
  //     handler: new NetworkFirst({
  //       cacheName: PAGES_CACHE_NAME.html,
  //       plugins: [
  //         new ExpirationPlugin({
  //           maxEntries: 32,
  //           maxAgeSeconds: 24 * 60 * 60, // 24 hours
  //         }),
  //       ],
  //       matchOptions,
  //     }),
  //   },
  //   ...defaultCache,
  // ],
});

// const urlsToCache = [
//   "/",
//   "/login",
//   "/signup",
//   "/reset",
//   "/forgot-password",
//   "/cookies",
//   "/terms",
//   "/privacy",
//   "/disclaimer",
//   "/~offline",
// ] as const;

// self.addEventListener("install", (event) => {
//   event.waitUntil(
//     Promise.all(
//       urlsToCache.map((entry) => {
//         const request = serwist.handleRequest({
//           request: new Request(entry),
//           event,
//         });
//         return request;
//       }),
//     ),
//   );
// });

serwist.addEventListeners();
