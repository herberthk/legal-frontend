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
| 403 | `FORBIDDEN` | authenticated but not allowed | show "not allowed"; rare on mobile |
| 404 | `NOT_FOUND` | resource missing **or not owned** | treat as "gone"; never assume it exists |
| 429 | `RATE_LIMITED` | too many requests | back off and retry later |
| 500/503 | `INTERNAL` | server/upstream error | retry with backoff (503) or report (500) |

> **404 is deliberately ambiguous.** Ownership checks return 404 (not 403) so a
> caller can't probe which ids exist. Don't special-case it as "forbidden."

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
      await auth().signOut(); // token can't be salvaged
    }
    throw new ApiError(res.status, code, message);
  }

  return json.data as T;
}
```

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
- **Map 402 to the paywall.** Any AI action can return 402; funnel it to the
  top-up flow rather than a generic error toast.
- **Offline & retry.** Wrap idempotent GETs with a small exponential backoff on
  network errors and 503. Never auto-retry non-idempotent POSTs (payments,
  ticket replies) — surface the failure and let the user decide.

## Gotchas

- A wrapped action's own failure (e.g. `createSupportTicket` returning
  `{ success: false }`) still arrives as **HTTP 200** inside `data`. Check
  `data.success` where the payload has it.
- `res.json()` throws on an empty body; the wrapper guards with `.catch(() => null)`.
- On `/review`, **do not** set `Content-Type` manually — `FormData` sets the
  multipart boundary. Setting it breaks the upload.
