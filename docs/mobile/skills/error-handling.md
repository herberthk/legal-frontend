# Error Handling & the `apiFetch` Wrapper — Mobile Agent Skill

> The one HTTP client every other feature is built on: envelope parsing, token
> attachment, App Check, and automatic 401 refresh-and-retry. Build this first.

## What this covers

- The `{ data }` / `{ error: { code, message } }` envelope and how to unwrap it.
- HTTP status → meaning, and what the client should do for each.
- A reference `apiFetch()` that attaches auth + App Check, parses the envelope,
  and refreshes an expired token exactly once before failing.
- Retry/offline strategy and the two non-enveloped routes (`/chat`, `/review`).

## Status codes

| Status | Envelope code | Meaning | Client action |
|---|---|---|---|
| 200 | — (`{data}`) | success | use `data` |
| 400 | `BAD_REQUEST` | malformed body/params | fix the request; show a generic error |
| 401 | `UNAUTHENTICATED` | missing/expired/revoked ID token | refresh token once, retry; if still 401, sign out |
| 401 | `APP_CHECK_FAILED` | missing/invalid App Check token | re-obtain App Check token; do **not** sign the user out |
| 402 | `PAYMENT_REQUIRED` | out of credit / inactive account | route to top-up (`skills/payments-*`) |
| 404 | `NOT_FOUND` | resource missing **or not owned** | treat as "gone"; never assume it exists |
| 500 | `INTERNAL` | non-retryable server fault | report; don't auto-retry |
| 503 | `INTERNAL` | retryable upstream/billing failure | back off and retry the same request |

> **404 is deliberately ambiguous.** Ownership checks return 404 (not 403) so a
> caller can't probe which ids exist. Don't special-case it as "forbidden."

> **⚠️ One route breaks the "401 = dead token" rule: `POST /voice/billing`.** It
> answers **401 `UNAUTHENTICATED`** when the `sessionId` belongs to a different uid,
> not only when the token is bad — so routing it through `apiFetch` would hit the
> `auth().signOut()` branch below and **sign the user out because of a stale session
> id**. Settle voice billing with a dedicated helper that treats 401 as "this
> session isn't mine, discard it" (see `voice-chat.md`). Everywhere else, a
> post-retry `401 UNAUTHENTICATED` genuinely does mean the session is dead.

> **`403 FORBIDDEN` and `429 RATE_LIMITED` are defined but unused.** Both codes
> exist in the `ApiErrorCode` union in `lib/api/v1/response.ts`, but **no route
> under `app/api/v1/**` currently emits either** — authorization failures are
> flattened to 404 by the ownership guards, and the pre-auth `/auth/**` routes rate
> limit inside the action rather than returning 429. Handle them defensively in a
> catch-all branch (they're cheap to support and may appear later), but don't build
> UI flows that depend on receiving them.

## Reference implementation

```ts
// lib/api.ts
import auth from "@react-native-firebase/auth";
import appCheck from "@react-native-firebase/app-check";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!; // ".../api/v1"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function authHeaders(
  forceRefreshAuth = false,
  forceRefreshAppCheck = false,
): Promise<Record<string, string>> {
  const user = auth().currentUser;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Not signed in.");

  const [idToken, appCheckResult] = await Promise.all([
    user.getIdToken(forceRefreshAuth),
    appCheck()
      .getToken(forceRefreshAppCheck)
      .catch(() => null),
  ]);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };
  if (appCheckResult?.token) {
    headers["X-Firebase-AppCheck"] = appCheckResult.token;
  }
  return headers;
}

/**
 * JSON fetch for the enveloped routes. Returns the unwrapped `data`.
 * Automatically refreshes the ID token / App Check token once on a 401 and retries.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
    ...(await authHeaders(_retried, _retried)), // fresh auth + App Check headers take precedence
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Retry once on an expired/revoked auth token or stale App Check token:
  if (res.status === 401 && !_retried) {
    const body = await res.clone().json().catch(() => null);
    const code = body?.error?.code;
    if (code === "UNAUTHENTICATED" || code === "APP_CHECK_FAILED") {
      return apiFetch<T>(path, init, true);
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const code = json?.error?.code ?? "INTERNAL";
    const message = json?.error?.message ?? `Request failed (${res.status}).`;
    if (res.status === 401 && code === "UNAUTHENTICATED") {
      await auth().signOut(); // token can't be salvaged — but see the /voice/billing warning
    }
    throw new ApiError(res.status, code, message);
  }

  return json.data as T;
}
```

> **The `signOut()` above assumes a 401 always means a dead token.** That holds for
> every route except `POST /voice/billing`, which also returns
> `401 UNAUTHENTICATED` when the `sessionId` isn't the caller's. Don't route that
> one through `apiFetch` (see `voice-chat.md`), or add an
> `{ allowUnauthenticated: true }` option that skips the sign-out.

Usage:

```ts
const me = await apiFetch<User>("/me");
const { transactions } = await apiFetch<{ transactions: Transaction[] }>(
  "/transactions?page=1&pageSize=20",
);
await apiFetch("/notifications/read-all", { method: "POST" });
```

## The two non-enveloped routes

`/chat` (SSE) and `/review` (multipart) do **not** go through `apiFetch` — their
success/error shapes differ (see their skills). But they use the **same auth +
App Check headers**, so factor `authHeaders()` out and reuse it:

```ts
// For /review (multipart): don't set Content-Type — let fetch set the boundary.
const headers = await authHeaders();
const form = new FormData();
form.append("file", { uri, name, type } as any);
const res = await fetch(`${BASE_URL}/review`, { method: "POST", headers, body: form });
const json = await res.json();
if (!res.ok || !json.success) throw new Error(json.error ?? "Review failed.");
```

## Best practices

- **One client module.** Never call `fetch` directly from a screen; always go
  through `apiFetch` (or the two dedicated helpers). This guarantees every request
  carries auth + App Check and parses errors uniformly.
- **Fresh token per request.** `getIdToken()` returns a cached token and only
  hits the network within ~5 min of expiry, so calling it per request is cheap
  and correct. Do **not** cache the string yourself.
- **Refresh exactly once.** The wrapper retries a single time with
  `forceRefresh=true`. A second 401 means the session is truly dead → sign out.
- **Distinguish `APP_CHECK_FAILED` from `UNAUTHENTICATED`.** The former is a
  device/attestation problem — re-obtain the App Check token and retry; do not
  sign the user out.
- **`POST /voice/billing` must not go through `apiFetch`.** That route answers a
  `sessionId` belonging to another uid with `401 UNAUTHENTICATED` (not 404), so the
  sign-out branch above would kick a perfectly valid user out of the app over a
  stale session id. Post it with a Bearer-only helper that treats 401 as "discard
  this session" — see `voice-chat.md`. It's also the one authenticated route with
  App Check **off**.
- **Map 402 to the paywall.** Any AI action can return 402; funnel it to the
  top-up flow rather than a generic error toast.
- **Offline & retry.** Wrap idempotent GETs with a small exponential backoff on
  network errors and 503. Don't blind-retry a non-idempotent POST (ticket replies,
  record saves) — surface the failure and let the user decide. The **one exception**
  is `POST /payments/momo/deposit`, which is idempotency-keyed: a `503` there *should*
  be retried with the **same** `idempotencyKey` (see `payments-mobile-money.md`).

## Gotchas

- A wrapped action's own failure (e.g. `createSupportTicket` returning
  `{ success: false }`) still arrives as **HTTP 200** inside `data`. Check
  `data.success` where the payload has it.
- `res.json()` throws on an empty body; the wrapper guards with `.catch(() => null)`.
- On `/review`, **do not** set `Content-Type` manually — `FormData` sets the
  multipart boundary. Setting it breaks the upload.
