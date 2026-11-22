import "server-only";
import { adminAppCheck } from "@/firebase/admin";
import { headers } from "next/headers";
import { PostHog } from "posthog-node";

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export let posthogMetricsClient: PostHog | null = null;

if (!posthogToken) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }
} else if (!posthogHost) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
} else {
  posthogMetricsClient = new PostHog(posthogToken, {
    host: posthogHost,
    metrics: { serviceName: "legal-adviser" },
  });
}

export interface AppCheckVerificationResult {
  valid: boolean;
  appId?: string;
  error?: string;
}

/**
 * Validates the Firebase App Check token sent via request headers.
 * Extracts the token from the "x-firebase-appcheck" header.
 *
 * @param req - Optional Request object (for API route handlers). If omitted, Next.js headers() is used.
 */
export async function verifyAppCheckHeader(
  req?: Request,
): Promise<AppCheckVerificationResult> {
  // In development, allow bypass if explicitly configured or if keys are not set up yet
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DISABLE_APP_CHECK === "true"
  ) {
    return { valid: true };
  }

  let token: string | null = null;

  if (req) {
    token =
      req.headers.get("x-firebase-appcheck") ||
      req.headers.get("X-Firebase-AppCheck");
  } else {
    try {
      const headerList = await headers();
      token =
        headerList.get("x-firebase-appcheck") ||
        headerList.get("X-Firebase-AppCheck");
    } catch {
      token = null;
    }
  }

  // In non-production, if no token was sent and no App Check key was provided, provide a soft fallback with a warning
  if (!token) {
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY
    ) {
      return { valid: true };
    }
    return { valid: false, error: "Missing App Check token." };
  }

  try {
    const appCheckClaims = await adminAppCheck.verifyToken(token);
    return { valid: true, appId: appCheckClaims.appId };
  } catch (err: unknown) {
    // In development mode, if verification fails due to unconfigured debug token, log and allow if fallback is needed
    const message =
      err instanceof Error ? err.message : "App Check token verification failed";
    console.error("[AppCheck Admin] Verification failed:", message);

    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY
    ) {
      return { valid: true };
    }

    return { valid: false, error: message };
  }
}
