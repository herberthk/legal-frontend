/**
 * Resolves a notification click target URL to a safe same-origin path.
 * Prioritizes relative `data.url` / `data.link` before `fcmOptions.link` so
 * localhost and preview environments route correctly even when `fcmOptions.link`
 * carries the production origin.
 */
export function resolveNotificationTargetUrl(
  rawData: unknown,
  origin: string,
): string {
  const data = (rawData ?? {}) as {
    url?: unknown;
    link?: unknown;
    FCM_MSG?: {
      fcmOptions?: { link?: unknown };
      data?: { url?: unknown; link?: unknown };
    };
  };

  const candidate =
    data.url ??
    data.link ??
    data.FCM_MSG?.data?.url ??
    data.FCM_MSG?.data?.link ??
    data.FCM_MSG?.fcmOptions?.link;

  if (typeof candidate !== "string" || !candidate.trim()) {
    return "/notifications";
  }

  try {
    const resolved = new URL(candidate, origin);
    if (resolved.origin !== origin) {
      return "/notifications";
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/notifications";
  }
}
