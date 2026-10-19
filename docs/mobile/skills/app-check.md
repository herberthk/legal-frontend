# App Check — Mobile Agent Skill

> Firebase App Check proves a request comes from your genuine, unmodified app
> binary. The mobile API **enforces** it on every authenticated route. Wire it
> early — a missing token surfaces as `401 APP_CHECK_FAILED`, which is easy to
> misread as an auth bug.

## What this covers

- What App Check protects and how the server enforces it.
- The exact enforcement policy (which routes require the header, which don't).
- iOS / Android / dev setup with `@react-native-firebase/app-check`.
- Attaching the token and the `DISABLE_APP_CHECK` dev bypass.

## Why

Bearer ID tokens prove *who* the user is; App Check proves *what* is making the
request. Because the mobile API is a public HTTPS surface backed by the Admin SDK
(which bypasses Firestore rules), App Check is the layer that stops a stolen ID
token from being replayed by a script outside the app. The server validates the
token with the same `verifyAppCheckHeader()` the web uses (Play Integrity / App
Attest / DeviceCheck attestation verified against the Firebase project).

## Header

```
X-Firebase-AppCheck: <app-check-token>
```

Attached automatically by `authHeaders()` in `error-handling.md`. Obtain it with
`appCheck().getToken()`.

## Enforcement policy (authoritative)

App Check is **ON for every authenticated route** — anything that takes a Bearer
token requires the App Check header too. It is **OFF** only where a token can't be
guaranteed:

| Routes | App Check | Reason |
|---|---|---|
| All `/me`, `/chats`, `/reviews`, `/transcriptions`, `/voice/token`, `/voice/sessions`, `/billing`, `/usage`, `/transactions`, `/payments/**`, `/notifications/**`, `/support/**`, `/chat`, `/review` | **ON** | authenticated app traffic |
| `/auth/signup/**`, `/auth/password/**`, `/auth/otp/resend` (6 pre-auth routes) | **OFF** | no user/session yet at signup/reset; protected by in-action rate limiting |
| `/auth/profile/sync`, `/auth/session` | **ON** | post-auth user setup and session telemetry |
| `POST /voice/billing` | **OFF** | fired from a backgrounded app (`AppState`), where a token may be unobtainable; billing must never be dropped, and the endpoint is idempotent + Bearer-authenticated |

> **Note for anyone comparing against an older design doc:** enforcement was
> tightened to cover *all* authenticated routes (not only the AI endpoints). Treat
> the table above as the source of truth. Practically: attach the App Check header
> on **every** call except the six pre-auth `/auth/**` routes, and it will always
> be correct — sending it on `/voice/billing` is harmless (the server ignores it
> there).

## Setup

### 1. Install

```
expo install @react-native-firebase/app @react-native-firebase/app-check
```

### 2. Initialize before any authed request

```ts
// app/_layout.tsx (or your root)
import appCheck from "@react-native-firebase/app-check";

const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
provider.configure({
  android: { provider: __DEV__ ? "debug" : "playIntegrity" },
  apple:   { provider: __DEV__ ? "debug" : "appAttest" },   // or "deviceCheck" for older devices
});

await appCheck().initializeAppCheck({
  provider,
  isTokenAutoRefreshEnabled: true,
});
```

- **Android production:** Play Integrity — enable it in Firebase console → App
  Check, and register the app's SHA-256.
- **iOS production:** App Attest (iOS 14+) with DeviceCheck fallback — register
  the Team ID + bundle ID in the console.
- **Development:** the `debug` provider prints a debug token to the console on
  first run; register it in Firebase console → App Check → *Manage debug tokens*.

### 3. Attach the token

Already handled by `authHeaders()`:

```ts
const { token } = await appCheck().getToken(false); // cached; auto-refreshed
headers["X-Firebase-AppCheck"] = token;
```

## Dev bypass

The backend honors `DISABLE_APP_CHECK=true` (server env) **only in non-production environments** (`NODE_ENV !== "production"`). In production, this flag is strictly ignored.

Additionally, in non-production environments (`NODE_ENV !== "production"`), if neither App Check key (`NEXT_PUBLIC_FIREBASE_APPCHECK_KEY` nor `NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY`) is configured on the server, missing or unverified debug tokens softly fall back to allowed.

With bypass/fallback active in development, you may omit the header. **It is a server-side configuration** — set it in your backend `.env` or development runtime.

## Best practices

- **Initialize App Check before the first authed call**, ideally before rendering
  the authed stack — otherwise the first few requests race and 401.
- **Enable `isTokenAutoRefreshEnabled`** so tokens refresh transparently.
- **Handle `APP_CHECK_FAILED` distinctly** from `UNAUTHENTICATED` (see
  `error-handling.md`): re-obtain the App Check token and retry; never sign the
  user out for it.
- **Don't gate `/voice/billing` on App Check** in your client either — send it
  Bearer-only from the background handler so a settle is never blocked.

## Optional: Expo Web / WebView targets

Native RN `fetch` does not enforce CORS, so the API ships no CORS headers by
default. If you also build for **Expo Web** or embed the API in a **WebView**, the
backend has a ready `CORS_HEADERS` helper and a `corsPreflight()` in
`lib/api/v1/response.ts` — a backend change is required to wire an `OPTIONS`
handler and spread those headers. This is intentionally off by default to keep the
same-origin posture; request it only if you ship a browser target.

## Gotchas

- A `401` with `code: "APP_CHECK_FAILED"` means the App Check token, not the ID
  token, was rejected. Refreshing the ID token won't help.
- The debug token is per-install; a fresh emulator/simulator needs re-registering.
- Play Integrity requires the app be distributed through a channel Google can
  attest (Play, internal testing). Sideloaded debug builds must use the `debug`
  provider.
