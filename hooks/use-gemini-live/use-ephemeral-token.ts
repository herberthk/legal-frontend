import { useCallback, useRef } from "react";

/**
 * Custom hook to manage fetching and caching the Gemini ephemeral token.
 */
export function useEphemeralToken() {
  const ephemeralTokenRef = useRef<{ token: string; expiresAt: number } | null>(
    null,
  );

  const getEphemeralToken = useCallback(async (forceRefresh = false) => {
    if (
      !forceRefresh &&
      ephemeralTokenRef.current &&
      Date.now() < ephemeralTokenRef.current.expiresAt - 5000
    ) {
      return ephemeralTokenRef.current.token;
    }

    // Clear the cache before fetching so a failed fetch doesn't leave a stale entry
    ephemeralTokenRef.current = null;

    const res = await fetch("/api/gemini-token");
    if (!res.ok) {
      throw new Error(`Failed to fetch ephemeral token: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    // Token valid for 30 minutes. We'll cache it for 25 mins.
    ephemeralTokenRef.current = {
      token: data.token,
      expiresAt: Date.now() + 25 * 60 * 1000,
    };
    return data.token;
  }, []);

  return { getEphemeralToken };
}
