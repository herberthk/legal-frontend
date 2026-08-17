import { signUp } from "@/lib/actions/auth";
import { getDecodedTokenFromRequest } from "@/lib/api/v1/auth";
import { verifyAppCheckHeader } from "@/lib/app-check-server";
import { ok, unauthenticated, appCheckFailed } from "@/lib/api/v1/response";

/**
 * `POST /api/v1/auth/profile/sync` — provisions a Firestore profile after the
 * client has signed in with a federated provider (e.g. Google) that creates a
 * Firebase Auth user but no app profile. Idempotent: `signUp` is a no-op if the
 * profile already exists.
 *
 * Identity is taken from the **verified ID token**, never the body — `uid` and
 * `email` come straight from the decoded claims. App Check IS enforced here: the
 * caller already holds a valid token, so an App Check token is available too.
 * Returns `{ data: { success, message } }`.
 */
export async function POST(req: Request) {
  const appCheck = await verifyAppCheckHeader(req);
  if (!appCheck.valid) return appCheckFailed(appCheck.error || undefined);

  const decoded = await getDecodedTokenFromRequest(req);
  if (!decoded) return unauthenticated();

  // Optional display overrides the client may supply; identity is not trusted.
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    avatar?: unknown;
  };
  const bodyName = typeof body?.name === "string" ? body.name : undefined;
  const bodyAvatar = typeof body?.avatar === "string" ? body.avatar : undefined;

  const result = await signUp({
    uid: decoded.uid,
    email: decoded.email ?? "",
    name: decoded.name ?? bodyName ?? decoded.email?.split("@")[0] ?? "User",
    avatar: decoded.picture ?? bodyAvatar,
  });
  return ok(result);
}
