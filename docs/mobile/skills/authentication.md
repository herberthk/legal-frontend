# Authentication — Mobile Agent Skill

> How the React Native client establishes a Firebase session and turns it into the
> `Authorization: Bearer <id-token>` that every `/api/v1` call requires.
> Covers email/password signup (OTP), email login, Google One Tap sign-in via
> `react-native-nitro-google-signin`, password reset, OTP resend, and logout.

## What this covers

- The ID-token model and why mobile uses it instead of the web's session cookie.
- Email/password signup with email OTP verification (two server calls + custom-token sign-in).
- Email login (client-side Firebase) + post-auth session & location telemetry (`/auth/session`).
- Google One Tap sign-in via `react-native-nitro-google-signin` + the `profile/sync` bootstrap.
- Password reset (three server calls: forgot -> verify -> reset).
- OTP resend.
- Logout.
- Direct Firebase access (where appropriate, per AGENTS.md section 9).

---

## Model

Legal Adviser uses **Firebase Authentication** as the single identity authority.
The mobile client owns the Firebase SDK session; the backend trusts the **ID token** it mints:

1. Client authenticates via the Firebase Auth SDK and obtains a `User`.
2. Client calls `user.getIdToken()` — a short-lived (~1 h) JWT.
3. Client sends `Authorization: Bearer <id-token>` on every `/api/v1` call.
4. Server verifies with `auth.verifyIdToken(token, true)` (checkRevoked = true).

Login and logout need **no server route** — they are Firebase SDK calls.
The `/api/v1` routes exist only for flows the SDK cannot perform alone:
OTP-gated signup, OAuth profile provisioning, post-login session telemetry, and OTP-based password reset.

Because the mobile app shares the **same Firebase project** as the web app (`legal-adviser-9cd92`),
direct Firestore reads (live chat history, transcription results, document status) are fine without
going through `/api/v1` — see AGENTS.md section 9.

---

## Packages

| Package | Version | Purpose |
|---|---|---|
| `@react-native-firebase/app` | 26.4.0 | Firebase native SDK core |
| `@react-native-firebase/auth` | 26.4.0 | Email/custom-token sign-in, auth state |
| `@react-native-firebase/app-check` | 26.4.0 | App attestation header for protected routes |
| `@react-native-firebase/firestore` | 26.4.0 | Direct real-time reads where appropriate |
| `@react-native-firebase/messaging` | 26.4.0 | FCM push token registration |
| `react-native-nitro-google-signin` | ^2.3.0 | Google One Tap / Credential Manager account picker |
| `react-native-nitro-modules` | ^0.37.1 | Nitro runtime (peer dep of the above) |
| `expo-location` | ~58.x | Foreground GPS for session telemetry |
| `expo-device` | ~58.x | Device metadata for session telemetry |

All Firebase packages are pinned to **26.4.0** together. Do not upgrade them independently.

---

## Architecture

```
src/lib/auth/firebase-provider.ts   — production AuthProvider (loaded dynamically)
  GoogleOneTapSignIn                — react-native-nitro-google-signin
  getAuth / signIn*                 — @react-native-firebase/auth (modular v26 API)
  initializeAppCheck                — @react-native-firebase/app-check

src/lib/auth-service.ts             — framework-free service layer (no React Native imports)
  initiateSignup / completeSignup
  signInEmail / signInWithGoogle
  forgotPassword / verifyResetOtp / resetPassword
  resendOtp / signOut
  bootstrapAccount                  — GET /me -> (404) POST /auth/profile/sync -> GET /me
  recordSessionTelemetry            — non-blocking, POST /auth/session

src/stores/auth-store.ts            — Zustand; runs startAuthRuntime() in initialize()
src/app/_layout.tsx                 — calls useAuthStore.initialize(); gates on status / BootstrapGate
```

`firebase-provider.ts` is always loaded with a dynamic `import()` so that
`bun test` can import `auth-service.ts` without parsing React Native source.
Tests inject a fake through `__setAuthProviderForTests`.

---

## Modular Firebase Auth API (v26)

The project uses the **modular** `@react-native-firebase/auth` v26 API,
not the legacy namespaced API.

```ts
// Correct — modular v26
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";

const auth = getAuth(getApp());
await signInWithEmailAndPassword(auth, email, password);

// Wrong — legacy namespaced (removed in v28+)
import auth from "@react-native-firebase/auth";
auth().signInWithEmailAndPassword(email, password); // do not use
```

---

## Email / password signup (OTP-verified)

Two server calls plus a custom-token sign-in. App Check is **off** on these routes.

### Step 1 — initiate

```
POST /api/v1/auth/signup/initiate
{ "name": "Jane Doe", "email": "jane@x.com", "password": "Passw0rd!" }
-> 200 { "data": { "success": true, "message": "Verification code sent to your email." } }
-> 200 { "data": { "success": false, "message": "<reason>" } }   // email taken / rate-limited
```

Server validates `name` (1-120 chars), `email`, and `password` (6-128 chars).
Creates a pending signup, emails a 6-digit OTP. IP + email rate-limited server-side.

**`success: false` with HTTP 200 is a real response — always check `data.success`.**

### Step 2 — complete

```
POST /api/v1/auth/signup/complete
{ "email": "jane@x.com", "otp": "123456" }
-> 200 { "data": { "success": true, "message": "Account created successfully.", "uid": "...", "customToken": "..." } }
-> 200 { "data": { "success": false, "message": "Invalid or expired OTP.", "uid": "", "customToken": "" } }
```

### Step 3 — exchange custom token

```ts
// auth-service.ts — completeSignup()
const result = await apiFetch("/auth/signup/complete", {
  method: "POST",
  body: { email, otp },
  auth: false,
  appCheck: false,
  schema: signupCompleteSchema,
});

if (!result.success || !result.customToken) {
  throw new AuthActionError(result.message ?? "That verification code is not valid.");
}

const provider = await getProvider();
const user = await provider.signInCustomToken(result.customToken);
const account = await bootstrapAccount(user);
void recordSessionTelemetry();
```

`signInCustomToken` in `firebase-provider.ts`:

```ts
import { signInWithCustomToken, getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";

const auth = getAuth(getApp());

async function signInCustomToken(token: string): Promise<ProviderUser> {
  const credential = await signInWithCustomToken(auth, token);
  return mapUser(credential.user);
}
```

> The `customToken` is **single-use** and short-lived. Exchange it immediately.
> Pre-auth routes must use `apiFetch` with `auth: false, appCheck: false` — never attach a Bearer header.

---

## Email login

Sign-in is fully client-side via the Firebase SDK:

```ts
// auth-service.ts — signInEmail()
const provider = await getProvider();
const user = await provider.signInEmail(email.trim().toLowerCase(), password);
const account = await bootstrapAccount(user);
void recordSessionTelemetry();
return account;
```

`firebase-provider.ts` implementation:

```ts
import { signInWithEmailAndPassword, getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";

const auth = getAuth(getApp());

async function signInEmail(email: string, password: string): Promise<ProviderUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return mapUser(credential.user);
}
```

Map Firebase error codes in `src/lib/auth/firebase-errors.ts`:

| Firebase code | User-visible message |
|---|---|
| `auth/invalid-credential` | The email or password is incorrect. |
| `auth/wrong-password` | The email or password is incorrect. |
| `auth/user-not-found` | The email or password is incorrect. |
| `auth/invalid-email` | Enter a valid email address. |
| `auth/user-disabled` | This account has been disabled. Contact support. |
| `auth/too-many-requests` | Too many attempts. Wait a few minutes and try again. |
| `auth/network-request-failed` | You appear to be offline. Check your connection and try again. |
| `auth/email-already-in-use` | An account with this email already exists. Sign in instead. |
| `auth/weak-password` | Choose a stronger password. |
| `auth/operation-not-allowed` | This sign-in method is not enabled for the app. |
| `auth/requires-recent-login` | Sign in again before changing this account setting. |

> **Enumeration guard:** `auth/invalid-credential`, `auth/wrong-password`, and `auth/user-not-found`
> deliberately map to the identical string (`"The email or password is incorrect."`) to avoid leaking whether an account exists.

---

## Google sign-in (react-native-nitro-google-signin)

### Configuration

`GoogleOneTapSignIn.configure` is called once (guarded by `googleConfigured`) before the first sign-in:

```ts
import { GoogleOneTapSignIn } from "react-native-nitro-google-signin";

GoogleOneTapSignIn.configure({
  webClientId: "autoDetect",  // reads google-services.json / GoogleService-Info.plist
  offlineAccess: true,
});
```

`webClientId: "autoDetect"` resolves the OAuth client ID from the native config files automatically.
No `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` environment variable is required.

### Sign-in cascade

The library uses a three-step cascade: silent restore -> One Tap sheet -> explicit picker.

```ts
// firebase-provider.ts — signInGoogle()
import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from "react-native-nitro-google-signin";
import { GoogleAuthProvider, signInWithCredential, getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";

const auth = getAuth(getApp());

async function signInGoogle(): Promise<ProviderUser | null> {
  ensureGoogleConfigured();
  await GoogleOneTapSignIn.checkPlayServices(true);

  // Step 1: silent restore — no UI; returns immediately if a credential is saved
  let response = await GoogleOneTapSignIn.signIn();

  // Step 2: One Tap sheet — shown when no saved credential is found
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }

  // Step 3: explicit account picker — fallback when One Tap is unavailable
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }

  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response)) {
    throw new AuthActionError("Google sign-in did not return an account.");
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new AuthActionError("Google sign-in succeeded but no ID token was returned.");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return mapUser(userCredential.user);
}
```

### Error code mapping

| `statusCodes` value | Meaning | User message |
|---|---|---|
| `SIGN_IN_CANCELLED` | User dismissed | (silent — return null) |
| `IN_PROGRESS` | No Activity / configure() not called | "Google sign-in could not start. Try again." |
| `PLAY_SERVICES_NOT_AVAILABLE` | Android only | "Google Play Services is unavailable on this device." |
| `ONE_TAP_START_FAILED` | One Tap cannot display | "Google sign-in could not start. Try again." |
| `SIGN_IN_REQUIRED` | Credential expired | "Sign in with Google again to continue." |
| `DEVELOPER_ERROR` | Misconfigured SHA / client ID | "Google sign-in is unavailable in this build." |

### Profile bootstrap after Google sign-in

`signInWithCredential` creates a Firebase Auth user but may not have a Firestore profile yet.
`bootstrapAccount` in `auth-service.ts` handles this automatically with a 404 -> sync -> retry pattern.
Do not call `profile/sync` directly from application code — `bootstrapAccount` owns it.

```
POST /api/v1/auth/profile/sync
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
{ "name"?: "Jane Doe", "avatar"?: "https://..." }   // optional; token claims always win
-> 200 { "data": { "success": true, "message": "Profile created successfully." } }
-> 200 { "data": { "success": true, "message": "Profile already exists." } }
```

Identity is taken from the **verified ID token claims** (`uid`, `email`, `name`, `picture`).
App Check is **enforced** on this route.

### Google sign-out

Sign-out also clears the Google SDK's local cache (fire-and-forget, must not block):

```ts
import { signOut as firebaseSignOut, getAuth } from "@react-native-firebase/auth";
import { GoogleOneTapSignIn } from "react-native-nitro-google-signin";

async function signOutEverywhere() {
  await firebaseSignOut(auth);
  void GoogleOneTapSignIn.signOut().catch(() => {}); // best-effort
}
```

---

## Session telemetry (`POST /auth/session`)

After every interactive sign-in, `recordSessionTelemetry()` runs **fire-and-forget**
(never awaited by the caller). App Check is enforced; `429 RATE_LIMITED` is swallowed silently.

```
POST /api/v1/auth/session
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
{
  "coordinates": { "latitude": 0.3476, "longitude": 32.5825, "accuracy": 15 },
  "device": {
    "platform": "android",
    "brand": "Samsung",
    "modelName": "Galaxy S24",
    "osName": "Android",
    "osVersion": "14"
  },
  "timezone": "Africa/Kampala",
  "resolution": "1080x2340"
}
-> 200 { "data": { "success": true } }
-> 429 { "error": { "code": "RATE_LIMITED", "message": "..." } }
```

**Rules:**
- `coordinates` is omitted when foreground location is not already granted.
  The server falls back to edge IP geolocation (`x-vercel-ip-country`, `x-vercel-ip-city`).
  **Never request the location permission inside the telemetry path** — a dialog mid-login
  looks indistinguishable from the app demanding tracking to sign in.
- GPS reads have a 5-second timeout (`LOCATION_TIMEOUT_MS = 5000`). Telemetry proceeds without
  coordinates on timeout.
- The server rounds GPS coordinates to 3 decimal places (~110 m) before Firestore storage.
- `apiFetch` is called with `authFailure: "ignore"` — a revoked/expired token must not
  sign the user out over a best-effort telemetry call.

Implementation: `src/lib/auth-service.ts -> recordSessionTelemetry()`,
tested in `src/lib/auth-service-telemetry.test.ts`.

---

## Account bootstrap (`bootstrapAccount`)

After every sign-in, `bootstrapAccount(providerUser)` must complete before authenticated
screens mount. It is idempotent and deduplicated per UID:

```
GET /api/v1/me        (App Check + Bearer required)
  200  -> profile committed; done.
  404  -> POST /api/v1/auth/profile/sync -> GET /me again -> done.
  other error -> re-throw; caller shows BootstrapGate with Retry / Sign out.
```

A stale-session guard checks that `currentUser().uid` still matches after the async `/me` call.
On mismatch a `StaleAuthError` is thrown and no data is committed.

`GET /api/v1/me` response shape:

```ts
type AccountProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: "SUPER_ADMIN" | "ADMIN" | "USER";
  balance?: number;           // US cents — divide by 100 for dollar display
  totalSpent?: number;
  status?: "active" | "suspended" | "banned";
  welcomeTextTokens?: number;
  freeTextTokens?: number;
  freeVoiceSeconds?: number;
  nextDailyReset?: string;    // ISO 8601
  createdAt?: string;
  updatedAt?: string;
  username?: string;
  phoneNumber?: string;
  preferedVoice?: { preferedVoiceId?: string; preferedVoiceName?: string };
  [key: string]: unknown;
};
```

> **Balance is stored in US cents.** Divide by 100 for dollar display.
> UGX conversion is display-only and the UI's responsibility.

---

## Password reset (three steps)

App Check is **off** on all three routes. The server enforces ordering:
`password/reset` rejects unless `password/verify` succeeded first.

### Step 1 — forgot

```
POST /api/v1/auth/password/forgot
{ "email": "jane@example.com" }
-> 200 { "data": { "success": true,  "message": "If an account exists with this email, a reset code has been sent." } }
-> 200 { "data": { "success": false, "message": "<operational error>" } }
```

> **Enumeration guard:** both a real account and an unknown address return `success: true` with the
> generic "If an account exists..." message. Always advance to the OTP screen regardless.
> Never branch the UI on whether `success` is true here.

### Step 2 — verify OTP

```
POST /api/v1/auth/password/verify
{ "email": "jane@example.com", "otp": "123456" }
-> 200 { "data": { "success": true,  "message": "OTP verified successfully." } }
-> 200 { "data": { "success": false, "message": "Invalid verification code." } }
-> 200 { "data": { "success": false, "message": "OTP has expired. Please request a new code." } }
-> 200 { "data": { "success": false, "message": "Too many failed attempts. Please request a new code." } }
-> 400 { "error": { "code": "BAD_REQUEST", "message": "..." } }
```

OTP rules (server-enforced): 6 digits, max 3 verify attempts, 15-minute expiry.
The route schema accepts `otp` as a 4-10 character string.

### Step 3 — set new password

```
POST /api/v1/auth/password/reset
{ "email": "jane@example.com", "newPassword": "NewPass1!" }
-> 200 { "data": { "success": true,  "message": "Password updated successfully." } }
-> 200 { "data": { "success": false, "message": "OTP not verified. Please verify your code first." } }
-> 200 { "data": { "success": false, "message": "No OTP request found. Please start over." } }
```

`newPassword` must be 6-128 characters.

After a successful reset, attempt an ordinary Firebase email sign-in. If the sign-in fails after
the reset succeeded, offer normal login and clearly tell the user the password was already changed.

### Service layer

```ts
// auth-service.ts
const email = await forgotPassword(rawEmail);
// user enters OTP
await verifyResetOtp(email, otp);       // throws AuthActionError on wrong/expired
await resetPassword(email, newPassword);
// Then sign in:
const account = await signInEmail(email, newPassword);
```

---

## OTP resend

```
POST /api/v1/auth/otp/resend
{ "email": "jane@example.com", "type": "signup" | "reset" }
-> 200 { "data": { "success": true, "message": "New verification code sent!" } }            // signup
-> 200 { "data": { "success": true, "message": "If an account exists with this email, a verification code has been sent." } } // reset — enumeration-safe
-> 200 { "data": { "success": false, "message": "<reason>" } }
```

- `type: "reset"` carries the same enumeration guard as `forgot`.
- `type: "signup"` returns the real `{ success, message }` because the email was already validated.

```ts
// auth-service.ts
await resendOtp(email, "signup"); // or "reset"
```

---

## Logout

```ts
// auth-service.ts — signOut()
const provider = await getProvider();
await provider.signOut();        // Firebase SDK sign-out + Google cache clear (fire-and-forget)
resetAuthServiceState();         // clears bootstrap dedup map
```

There is **no server logout endpoint**. Dropping the Firebase session is sufficient;
`verifyIdToken(token, true)` rejects revoked tokens server-side.

**Logout order:**
1. Deregister the device push token (see `push-notifications.md`).
2. Stop active voice/chat streaming sessions.
3. Call `signOut()` from `auth-service.ts`.
4. Clear visible client state before another account can see it.

---

## Auth-state runtime

`startAuthRuntime(callbacks)` in `auth-service.ts` starts the single `onAuthStateChanged`
subscription. It is wired inside `useAuthStore.initialize()`, which the root layout triggers on mount:

```ts
// src/stores/auth-store.ts — initialize()
startAuthRuntime({
  onHydrated: () => set({ hasHydrated: true }),
  onSignedOut: () => { deactivateAccountStores(); set(signedOutState()); },
  onBootstrapStart: () => set({ status: "bootstrapping" }),
  onBootstrapSuccess: (account) => { void commitAccount(account); },
  onBootstrapError: (error) => set({ status: "error", error: messageOf(error) }),
});

// src/app/_layout.tsx
const initializeAuth = useAuthStore((s) => s.initialize);
useEffect(() => { void initializeAuth(); }, [initializeAuth]);

// Root layout gates rendering based on store status:
// isRestoring || authStatus === "error" -> <BootstrapGate />
// authStatus === "signedIn" -> <AuthNavigator />
```

A 10-second watchdog (`AUTH_FIRST_STATE_TIMEOUT_MS = 10_000`) fires `onBootstrapError` if
the native module never delivers the first auth-state callback, preventing a permanent blank screen.
The subscription stays live so a late callback still recovers the session.

---

## Direct Firebase access

Per AGENTS.md section 9, the mobile app connects **directly to Firebase** for operations
that benefit from real-time sync or need no server-side business logic:

| Operation | Connection |
|---|---|
| Chat message stream | Firestore direct (real-time listener) |
| Transcription result polling | Firestore direct (real-time listener) |
| Document review status | Firestore direct (real-time listener) |
| File uploads (OCR input, avatar images) | Firebase Storage direct |
| Push token registration | FCM via `@react-native-firebase/messaging` |
| Auth state subscription | Firebase Auth SDK `onAuthStateChanged` |
| Profile reads (`/me`) | `/api/v1/me` — business logic + App Check gate |
| Billing and payment actions | `/api/v1` — server enforces all money rules |

The shared Firebase project is `legal-adviser-9cd92`. Tokens minted by either the web app
or the mobile app are valid on the shared backend.

---

## Security

- **Never store the ID token.** Call `getIdToken()` (or use `apiFetch`, which calls it per request).
  The Firebase SDK handles native persistence and token refresh. Do not copy tokens to MMKV.
- **Pre-auth routes** (`/auth/signup/**`, `/auth/password/**`, `/auth/otp/**`) use
  `apiFetch` with `auth: false, appCheck: false`. They do not accept a Bearer header.
- **App Check is enforced** on `/auth/profile/sync`, `/auth/session`, and all authenticated routes.
- **`profile/sync` is idempotent** — safe to call on every Google sign-in.
- **Gate the app on `onAuthStateChanged`.** Mount the authenticated stack only once
  `bootstrapAccount` resolves successfully.

---

## Environment configuration

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL for `/api/v1` (e.g. `https://legaladviser.netbritz.com`) |
| `APP_CHECK_DEBUG_TOKEN` | App Check debug token for dev builds (must be registered in Firebase Console) |

Google client IDs are read from `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
`GoogleOneTapSignIn.configure({ webClientId: "autoDetect" })` resolves them automatically.

---

## Gotchas

- **`success: true` does not mean the email exists.** `/auth/password/forgot` and
  `/auth/otp/resend` with `type: "reset"` mask unknown addresses behind a generic message.
- **App Check is off on pre-auth routes** but **on for `profile/sync` and `session`**.
  In dev, set `DISABLE_APP_CHECK=true` on the server or register the App Check debug token.
- **`IN_PROGRESS` from `react-native-nitro-google-signin`** means no Activity context or
  `configure()` was not called — not that another sign-in is already in progress.
- **`signInWithCustomToken` is single-use.** Exchange the `customToken` from
  `/auth/signup/complete` immediately after receiving it.
- **Balance is in US cents.** `profile.balance` is an integer cent value. Display as dollars
  (`balance / 100`). UGX conversion is display-only.
- **Do not call `profile/sync` from application code.** `bootstrapAccount` owns the
  404 -> sync -> retry pattern. Adding a second call site creates a race condition.
- **Telemetry is fire-and-forget.** Never `await recordSessionTelemetry()` — a GPS timeout
  or rate-limit must not block navigation into the app.
- **`onUnauthenticated`** on `AuthTokenProvider` is called by `apiFetch` after a final
  `401 UNAUTHENTICATED`. It signs the user out via Firebase, which the `onAuthStateChanged`
  subscription picks up. Do not call `signOut` from UI error handlers; let the subscription drive it.
