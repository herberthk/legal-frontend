/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

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
const firebaseApp = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
});

const messaging = getMessaging(firebaseApp);

/**
 * Background message handler — fires when the web app is NOT in focus.
 * FCM automatically creates a notification from the `notification` field;
 * we override the options here to provide consistent icon / badge branding.
 */
onBackgroundMessage(messaging, (payload) => {
  console.log("[FCM] Background message received:", payload);
  const { title, body, icon } = payload.notification ?? {};
  const notificationTitle: string = title ?? "Legal Adviser";
  const notificationOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body: body ?? "",
    icon: icon ?? "/icons/apple-icon-180.png",
    badge: "/icons/mstile-icon-128.png",
    data: payload.data ?? {},
    // Professional feel: vibrate the device and allow re-notification
    vibrate: [200, 100, 200],
    renotify: true,
    // Replace any previous notification from this app so the tray stays tidy
    tag: "legal-adviser-push",
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

/** Navigate / focus the app tab when a notification is clicked. */
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = (event.notification.data?.url as string) ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Domains that must bypass the service worker entirely.
 *
 * Firebase Authentication uses popup/redirect flows that load scripts and
 * iframes from Google's infrastructure. If the SW intercepts those requests
 * it re-fetches them under its own execution context, which may be subject
 * to a restrictive Content-Security-Policy set on the sw.js response.
 * By responding with a plain `fetch()` BEFORE Serwist registers its router
 * we ensure the browser handles these requests natively and the auth flow
 * completes successfully.
 */
const GOOGLE_FIREBASE_ORIGINS = [
  "https://apis.google.com",
  "https://www.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://firebasestorage.googleapis.com",
  "https://firebaselogging.googleapis.com",
  "https://www.gstatic.com",
  "https://accounts.google.com",
  "https://storage.googleapis.com",
  // FCM push registration & delivery endpoints
  "https://fcm.googleapis.com",
  "https://fcmregistrations.googleapis.com",
];

// This listener is registered BEFORE serwist.addEventListeners() so it runs
// first. The first handler to call event.respondWith() wins — Serwist never
// sees these requests.
self.addEventListener("fetch", (event: FetchEvent) => {
  try {
    const { origin } = new URL(event.request.url);
    if (GOOGLE_FIREBASE_ORIGINS.includes(origin)) {
      // Bypass the SW router and go straight to the network.
      event.respondWith(fetch(event.request));
    }
  } catch {
    // Ignore non-absolute URLs (e.g. extension: or blob: schemes).
  }
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true, // Whether the service worker should skip waiting and become the active one.
  clientsClaim: true, // Whether the service worker should claim all clients.
  navigationPreload: false,
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
