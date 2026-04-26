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
