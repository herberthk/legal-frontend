import { useCallback, useRef } from "react";
import { getAppCheckToken } from "@/lib/firebaseAppCheck";

/**
 * Custom hook to manage fetching and single-use prefetching of the Gemini ephemeral token.
 *
 * NOTE: In Google GenAI Live API, ephemeral tokens have `uses: 1` and are strictly
 * single-use vouchers. Passing an already-used token to live.connect() causes Google
 * to close the WebSocket with code 1011 ("Token has been used too many times").
 *
 * Therefore:
 * - A prefetched token is stored only until it is consumed by a connection attempt.
 * - Calling getEphemeralToken() consumes the prefetched token and immediately clears
 *   it, guaranteeing that no token is ever reused across multiple connection attempts.
 * - Subsequent connections, retries, and reconnects will always fetch a fresh token.
 */
export function useEphemeralToken() {
  const prefetchedTokenRef = useRef<{
    token: string;
    expiresAt: number;
    voiceId?: string;
    voiceName?: string;
  } | null>(null);

  const inFlightPromiseRef = useRef<{
    promise: Promise<string>;
    voiceId?: string;
    voiceName?: string;
  } | null>(null);

  const clearCachedToken = useCallback(() => {
    prefetchedTokenRef.current = null;
    inFlightPromiseRef.current = null;
  }, []);

  const fetchNewToken = useCallback(
    async (
      maxSecs?: number,
      voiceId?: string,
      voiceName?: string,
    ): Promise<string> => {
      const appCheckToken = await getAppCheckToken();

      const params = new URLSearchParams();
      if (maxSecs != null) params.set("maxSecs", String(Math.round(maxSecs)));
      if (voiceId) params.set("voiceId", voiceId);
      if (voiceName) params.set("voiceName", voiceName);
      const qs = params.toString();
      const url = qs ? `/api/gemini-token?${qs}` : "/api/gemini-token";

      const res = await fetch(url, {
        headers: {
          ...(appCheckToken ? { "x-firebase-appcheck": appCheckToken } : {}),
        },
      });

      let data: { token?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response
      }

      if (!res.ok || data.error) {
        const statusText = res.statusText || "Request failed";
        throw new Error(
          data.error ||
            `Failed to fetch ephemeral token: ${res.status} ${statusText}`,
        );
      }
      if (!data.token) {
        throw new Error("No ephemeral token returned from server.");
      }

      return data.token;
    },
    [],
  );

  const prefetchToken = useCallback(
    (maxSecs?: number, voiceId?: string, voiceName?: string) => {
      // If we already have a valid prefetched token for this voice, keep it
      if (
        prefetchedTokenRef.current &&
        Date.now() < prefetchedTokenRef.current.expiresAt - 5000 &&
        prefetchedTokenRef.current.voiceId === voiceId &&
        prefetchedTokenRef.current.voiceName === voiceName
      ) {
        return;
      }

      // If an in-flight fetch for the same voice is already running, wait for it
      if (
        inFlightPromiseRef.current &&
        inFlightPromiseRef.current.voiceId === voiceId &&
        inFlightPromiseRef.current.voiceName === voiceName
      ) {
        return;
      }

      const record: {
        promise: Promise<string>;
        voiceId?: string;
        voiceName?: string;
      } = {
        promise: Promise.resolve(""),
        voiceId,
        voiceName,
      };

      record.promise = (async () => {
        try {
          const token = await fetchNewToken(maxSecs, voiceId, voiceName);
          prefetchedTokenRef.current = {
            token,
            expiresAt: Date.now() + 30 * 60 * 1000,
            voiceId,
            voiceName,
          };
          return token;
        } finally {
          if (inFlightPromiseRef.current === record) {
            inFlightPromiseRef.current = null;
          }
        }
      })();

      inFlightPromiseRef.current = record;
      record.promise.catch((err) => {
        console.warn(
          "[gemini-live] Token prefetch failed (will fetch on connect):",
          err,
        );
      });
    },
    [fetchNewToken],
  );

  const getEphemeralToken = useCallback(
    async (
      forceRefresh = false,
      maxSecs?: number,
      voiceId?: string,
      voiceName?: string,
    ): Promise<string> => {
      // 1. If not forcing a refresh, check if we have a valid UNCONSUMED prefetched token
      if (
        !forceRefresh &&
        prefetchedTokenRef.current &&
        Date.now() < prefetchedTokenRef.current.expiresAt - 5000 &&
        prefetchedTokenRef.current.voiceId === voiceId &&
        prefetchedTokenRef.current.voiceName === voiceName
      ) {
        const token = prefetchedTokenRef.current.token;
        // CONSUME IT: ephemeral tokens are single-use; once taken for a connection,
        // it must never be used for another connection or reconnect.
        prefetchedTokenRef.current = null;
        return token;
      }

      // 2. If an in-flight prefetch is currently running for the SAME voice, consume its result
      if (
        !forceRefresh &&
        inFlightPromiseRef.current &&
        inFlightPromiseRef.current.voiceId === voiceId &&
        inFlightPromiseRef.current.voiceName === voiceName
      ) {
        const inFlight = inFlightPromiseRef.current;
        inFlightPromiseRef.current = null;
        const token = await inFlight.promise;
        // CONSUME IT
        prefetchedTokenRef.current = null;
        return token;
      }

      // 3. Clear any stale prefetched token and fetch a fresh one directly
      prefetchedTokenRef.current = null;
      return fetchNewToken(maxSecs, voiceId, voiceName);
    },
    [fetchNewToken],
  );

  return { getEphemeralToken, prefetchToken, clearCachedToken };
}
