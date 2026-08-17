import "server-only";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { getUserIdFromRequest, getUserFromRequest } from "./auth";
import { appCheckFailed, unauthenticated } from "./response";

export type MobileAuth = { userId: string };
export type MobileUser = { user: User };

/**
 * Composes the two gates every authenticated mobile route needs:
 *   1. App Check attestation — proves the request comes from the genuine app
 *      binary. ON by default (the user opted to *enforce* App Check); the
 *      existing `verifyAppCheckHeader` already carries the `DISABLE_APP_CHECK`
 *      dev bypass, so local testing needs no code change.
 *   2. Firebase ID-token verification (Bearer).
 *
 * Returns `{ userId }` on success, or a ready-to-return error `Response`.
 * Usage:
 *   const gate = await requireMobileAuth(req);
 *   if (gate instanceof Response) return gate;
 *   // gate.userId is now trusted
 *
 * The pre-auth routes (`/api/v1/auth/**`) don't use this — they have no user
 * yet and rely on the in-action rate limiting the web already uses. The two AI
 * routes (`chat`, `review`) also don't use this: they inline App Check +
 * `getUserIdFromRequest` so their error shape stays identical to the web twin.
 */
export async function requireMobileAuth(
  req: Request,
  opts: { appCheck?: boolean } = {},
): Promise<MobileAuth | Response> {
  const { appCheck = true } = opts;

  if (appCheck) {
    const appCheckResult = await verifyAppCheckHeader(req);
    if (!appCheckResult.valid) {
      return appCheckFailed(appCheckResult.error || undefined);
    }
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return unauthenticated();
  }

  return { userId };
}

/**
 * Like `requireMobileAuth`, but resolves the full Firestore user document
 * (`name`, `email`, `role`, …) behind the same App Check + Bearer gates.
 *
 * Use this only where a route must inject **server-trusted identity** into a
 * write — support tickets stamp `userName`/`email` from the doc, and a ticket
 * reply's `senderRole` MUST be the caller's real role (a client-supplied
 * `ADMIN`/`SUPER_ADMIN` would trigger the admin-reply email path — a privilege
 * escalation). For routes that only need the uid, prefer `requireMobileAuth`
 * (one fewer Firestore read).
 */
export async function requireMobileUser(
  req: Request,
  opts: { appCheck?: boolean } = {},
): Promise<MobileUser | Response> {
  const { appCheck = true } = opts;

  if (appCheck) {
    const appCheckResult = await verifyAppCheckHeader(req);
    if (!appCheckResult.valid) {
      return appCheckFailed(appCheckResult.error || undefined);
    }
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return unauthenticated();
  }

  return { user };
}
