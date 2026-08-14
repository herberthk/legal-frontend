import { getToken } from "firebase/app-check";
import { appCheck } from "@/firebase/client";

/**
 * Retrieves the current Firebase App Check token on the client side.
 * Returns null if running in SSR, if App Check is not initialized, or if retrieval fails.
 *
 * @param forceRefresh - Whether to force token refresh instead of using the cached token.
 */
export async function getAppCheckToken(
  forceRefresh = false,
): Promise<string | null> {
  if (typeof window === "undefined" || !appCheck) {
    return null;
  }

  try {
    const result = await getToken(appCheck, forceRefresh);
    return result?.token ?? null;
  } catch (error) {
    console.warn("[AppCheck] Unable to retrieve token:", error);
    return null;
  }
}
