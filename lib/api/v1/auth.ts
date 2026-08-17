import "server-only";
import { auth, db } from "@/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";
import { COLLECTIONS } from "@/constants";

/**
 * Mobile authentication shim for the `/api/v1/**` surface.
 *
 * The web app derives identity from an HTTP-only `session` cookie minted by the
 * Admin SDK. A React Native client has no browser cookie jar, so mobile instead
 * sends a fresh Firebase **ID token** on every request via
 * `Authorization: Bearer <idToken>`. We verify it with the SAME admin `auth`
 * already used by `signIn()` (`auth.verifyIdToken`) — no new dependency, no new
 * trust boundary. Mobile keeps the token fresh with the Firebase SDK.
 *
 * These helpers are the Bearer counterparts of `getAuthenticatedUserId()` and
 * `getCurrentUser()` in `lib/actions/auth.ts`.
 */

/**
 * Pulls the ID token out of `Authorization: Bearer <token>`.
 * Returns `null` when the header is absent or malformed.
 */
function extractBearerToken(req: Request): string | null {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Verifies the Bearer ID token and returns the full decoded claims
 * (`uid`, `email`, `name`, `picture`, …) or `null` if absent/invalid.
 *
 * `checkRevoked = true` mirrors the web's `verifySessionCookie(cookie, true)`
 * so a signed-out or disabled account is rejected server-side rather than
 * riding a still-valid token. `getUserIdFromRequest` / `getUserFromRequest`
 * build on this; `POST /api/v1/auth/profile/sync` uses the claims directly to
 * provision a Firestore profile after client-side OAuth.
 */
export async function getDecodedTokenFromRequest(
  req: Request,
): Promise<DecodedIdToken | null> {
  const idToken = extractBearerToken(req);
  if (!idToken) return null;
  try {
    return await auth.verifyIdToken(idToken, true);
  } catch {
    return null;
  }
}

/**
 * Bearer counterpart of `getAuthenticatedUserId()`.
 */
export async function getUserIdFromRequest(
  req: Request,
): Promise<string | null> {
  const decoded = await getDecodedTokenFromRequest(req);
  return decoded?.uid ?? null;
}

/**
 * Bearer counterpart of `getCurrentUser()`: verifies the ID token and returns
 * the full Firestore user document with dates normalised to ISO strings —
 * byte-for-byte the shape `getCurrentUser()` returns for the web.
 */
export async function getUserFromRequest(req: Request): Promise<User | null> {
  const decoded = await getDecodedTokenFromRequest(req);
  if (!decoded) return null;
  try {
    const userSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .doc(decoded.uid)
      .get();

    if (!userSnapshot.exists) return null;

    const data = userSnapshot.data();
    return {
      ...data,
      id: userSnapshot.id,
      createdAt:
        data?.createdAt?.toDate().toISOString() || new Date().toISOString(),
      nextDailyReset:
        data?.nextDailyReset?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        data?.updatedAt?.toDate().toISOString() || new Date().toISOString(),
    } as User;
  } catch (error) {
    console.error("getUserFromRequest Error:", error);
    return null;
  }
}
