import { useEffect, useState } from "react";

export interface CacheUpdateEvent {
  cacheName: string;
  updatedURL: string;
}

/**
 * A hook to listen for cache updates broadcasted by the Serwist service worker
 * using the BroadcastUpdatePlugin.
 *
 * @param cacheNameFilter - Optional string to filter updates to a specific cache name (e.g., "images").
 */
export function useSerwistBroadcastUpdate(cacheNameFilter?: string) {
  const [updates, setUpdates] = useState<CacheUpdateEvent[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Ensure the message came from Serwist and is a cache update
      if (
        event.data &&
        event.data.meta === "serwist-broadcast-update" &&
        event.data.type === "CACHE_UPDATED"
      ) {
        const payload = event.data.payload;

        if (cacheNameFilter && payload.cacheName !== cacheNameFilter) {
          return;
        }

        const updateEvent: CacheUpdateEvent = {
          cacheName: payload.cacheName,
          updatedURL: payload.updatedURL,
        };

        setUpdates((prev) => [...prev, updateEvent]);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [cacheNameFilter]);

  const clearUpdates = () => setUpdates([]);

  return { updates, clearUpdates };
}
