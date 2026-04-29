/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
  navigationPreload: true, // Whether the service worker should preload navigation requests.
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
  },
});

serwist.addEventListeners();
