# Authentication — Mobile Agent Skill

> How a React Native client establishes a Firebase session and turns it into the
> `Authorization: Bearer <id-token>` every API call needs. Covers email/password
> signup (OTP), login, Google sign-in, and password reset.

## What this covers

- The ID-token model and why mobile uses it instead of the web's session cookie.
- Email/password signup with email OTP verification (two server calls).
- Login (client-side Firebase) + post-auth session & location telemetry (`/auth/session`).
- Google sign-in + the `profile/sync` bootstrap.
- Password reset (three server calls: forgot → verify → reset).
- OTP resend.

## Model

Legal Adviser uses **Firebase Authentication**. The mobile client owns the
Firebase session; the backend trusts the **ID token** it mints:

1. Client authenticates with the Firebase Auth SDK → gets a `User`.
2. Client calls `user.getIdToken()` → a short-lived (~1h) JWT.
3. Client sends `Authorization: Bearer <id-token>` on every `/api/v1` call.
4. Server verifies with `auth.verifyIdToken(token, true)`.

Login and logout therefore need **no server route** — they are Firebase SDK
calls. The server routes below exist only for flows the SDK can't do alone:
OTP-gated signup, OAuth profile provisioning, post-login session telemetry with
location, and OTP password reset (all of which touch Firestore/email via the Admin SDK).

### Packages

```
@react-native-firebase/app
@react-native-firebase/auth
@react-native-google-signin/google-signin   # Google sign-in
expo-location                              # Location capture during login
expo-device                                # Device telemetry (model, OS)
```

---

## Email / password signup (OTP-verified)

Two server calls plus a client sign-in. App Check is **off** on these routes.

### Step 1 — initiate

```
POST /auth/signup/initiate
{ "name": "Jane Doe", "email": "jane@x.com", "password": "•••••••" }
→ 200 { "data": { "success": true, "message": "OTP sent to your email." } }
```

Server creates the pending account and emails a 6-digit OTP. Rate-limited by IP +
email inside the action, so no client throttling is needed (but debounce the
button).

### Step 2 — complete

```
POST /auth/signup/complete
{ "email": "jane@x.com", "otp": "123456" }
→ 200 { "data": { "success": true, "uid": "…", "customToken": "…" } }
```

### Step 3 — sign in with the custom token

```ts
import auth from "@react-native-firebase/auth";

const { data } = await postJson("/auth/signup/complete", { email, otp });
if (!data.success) throw new Error(data.message);
await auth().signInWithCustomToken(data.customToken);
// auth().currentUser is now set; getIdToken() works.
```

`postJson` here is a thin `fetch` that returns the parsed body (these routes are
pre-auth, so it must **not** attach a Bearer header — use a bare fetch, not
`apiFetch`).

---

## Login & Session Telemetry (Location)

Sign-in itself is client-side via the Firebase SDK:

```ts
const userCredential = await auth().signInWithEmailAndPassword(email, password);
```

Map Firebase error codes (`auth/wrong-password`, `auth/user-not-found`,
`auth/too-many-requests`, …) to friendly copy on the client.

### Recording session & location (`POST /auth/session`)

Immediately after sign-in (or Google sign-in / custom-token sign-in), the mobile app
captures location and device metadata and sends them to `POST /auth/session`
(Bearer required, App Check **on**).

```
POST /auth/session
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
{
  "coordinates": {
    "latitude": 0.3476,
    "longitude": 32.5825,
    "accuracy": 15
  },
  "device": {
    "platform": "ios",
    "brand": "Apple",
    "modelName": "iPhone 15 Pro",
    "osName": "iOS",
    "osVersion": "17.4"
  },
  "timezone": "Africa/Kampala",
  "resolution": "1179x2556"
}
→ 200 { "data": { "success": true } }
```

### Reference React Native Implementation (`expo-location` + `expo-device`)

```ts
import * as Location from "expo-location";
import * as Device from "expo-device";
import { Dimensions, PixelRatio, Platform } from "react-native";
import { apiFetch } from "@/lib/api";

/**
 * Retrieves client location safely without blocking the login experience.
 */
export async function getClientLocation() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (requested.status !== "granted") return undefined;
    }

    // Try last known position first (fastest, 0ms delay)
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown && Date.now() - lastKnown.timestamp < 10 * 60 * 1000) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy,
      };
    }

    // Fall back to current position with balanced accuracy (saves battery & time)
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      accuracy: current.coords.accuracy,
    };
  } catch (err) {
    console.warn("Location capture failed (non-fatal):", err);
    return undefined;
  }
}

/**
 * Fires post-login session recording (non-blocking).
 */
export function recordMobileLoginSession() {
  void (async () => {
    try {
      const coordinates = await getClientLocation();
      const { width, height } = Dimensions.get("screen");

      await apiFetch("/auth/session", {
        method: "POST",
        body: JSON.stringify({
          coordinates,
          device: {
            platform: Platform.OS,
            brand: Device.brand ?? undefined,
            modelName: Device.modelName ?? undefined,
            osName: Device.osName ?? undefined,
            osVersion: Device.osVersion ?? undefined,
          },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          resolution: `${PixelRatio.getPixelSizeForLayoutSize(width)}x${PixelRatio.getPixelSizeForLayoutSize(height)}`,
        }),
      });
    } catch (err) {
      console.warn("Failed to record login session telemetry:", err);
    }
  })();
}
```

### Best practices for mobile location & telemetry

1. **Non-blocking UX**: Never stall the login spinner or delay navigation into the
   app waiting for GPS lock. Fire `recordMobileLoginSession()` as a background task
   right as the user is navigated into the main screen.
2. **Graceful degradation**: If the user denies location permission, `coordinates`
   is omitted. The server automatically falls back to edge IP geolocation (`x-vercel-ip-country`,
   `x-vercel-ip-city`).
3. **Privacy by default**: Server-side code rounds GPS coordinates to 3 decimal
   places (~110m) before saving to Firestore to reduce location precision. Rounding
   alone does not establish compliance with applicable privacy laws, including GDPR
   or Uganda’s Data Protection and Privacy Act.
4. **Fraud detection**: The server logs both client GPS coordinates and edge IP
   geolocation, allowing cross-verification to detect proxy/VPN usage or location spoofing.

---

## Google sign-in

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
});

async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type === "cancelled") return; // user dismissed the dialog

  const idToken = response.data?.idToken;
  if (!idToken)
    throw new Error("Google Sign-In succeeded but no ID token was returned.");

  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);

  // Bootstrap the Firestore profile (idempotent — safe to call every sign-in).
  await apiFetch("/auth/profile/sync", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
```

`POST /auth/profile/sync` (App Check **on**, Bearer required) reads identity from
the verified token (`uid`, `email`, `name`, `picture`) and creates the Firestore
user document if it doesn't exist. The body may optionally carry `{ name, avatar }`
as fallbacks, but the token's claims win. It returns `{ data: { success, message } }`.

---

## Password reset (three steps)

App Check **off** on all three. The order is enforced server-side — `reset`
fails unless `verify` succeeded first.

```
POST /auth/password/forgot   { "email" }                    → sends reset OTP
POST /auth/password/verify   { "email", "otp" }             → marks OTP verified
POST /auth/password/reset    { "email", "newPassword" }     → sets new password
```

> **`forgot` never reveals whether the email exists.** Both a real account and an
> unknown address return the same
> `200 { "data": { "success": true, "message": "If an account exists with this email, a reset code has been sent." } }`.
> This is a deliberate account-enumeration guard, so **`success: true` is not proof
> an OTP was sent.** Show that message verbatim and advance to the OTP screen
> regardless — never branch the UI on it, and never tell the user "no account found"
> at this step. The real signal arrives at `verify`, which fails for a code that was
> never issued.

```ts
await postJson("/auth/password/forgot", { email });
// … user enters OTP …
const verify = await postJson("/auth/password/verify", { email, otp });
if (!verify.data.success) throw new Error(verify.data.message); // wrong/expired OTP
await postJson("/auth/password/reset", { email, newPassword });
// Then sign in normally with the new password.
```

OTP rules (server-enforced): max 3 verify attempts, 15-minute expiry.
`otp` is validated as a 4–10 character string; `newPassword` must be 6–128 chars.

---

## Resend OTP

```
POST /auth/otp/resend   { "email", "type": "signup" | "reset" }
```

Use the correct `type` for the flow in progress. Also rate-limited server-side.

**`type: "reset"` carries the same enumeration guard as `forgot`** — an unknown
email still returns
`200 { "data": { "success": true, "message": "If an account exists with this email, a verification code has been sent." } }`.
`type: "signup"` does **not** mask its result: there the action's real
`{ success, message }` comes back, because the address was already submitted in
step 1 of signup so nothing new is leaked.

---

## Logout

```ts
// Unregister the device from push first (see push-notifications.md), then:
await auth().signOut();
```

Clear any cached user state. There is no server logout route — dropping the token
is sufficient; `verifyIdToken(token, true)` would reject it after a Firebase-level
revocation anyway.

## Best practices

- **Reuse the web Firebase project.** Tokens only verify if the mobile app points
  at the same Firebase project as the backend. Use the same
  `NEXT_PUBLIC_FIREBASE_*` values (as `EXPO_PUBLIC_FIREBASE_*`).
- **Don't store the ID token.** Store nothing; call `getIdToken()` per request.
  Persist only the Firebase session, which the SDK does automatically.
- **Pre-auth calls skip `apiFetch`.** The six `/auth/**` routes take no Bearer
  token. Sending a stale/absent one is harmless but don't rely on `apiFetch`'s
  refresh logic there.
- **Gate the app on `onAuthStateChanged`.** Render the authed stack only once a
  `User` exists, so screens never call `apiFetch` without a session.

## Gotchas

- `signInWithCustomToken` is the intended path after `signup/complete` — the
  returned `customToken` is single-use and short-lived; sign in immediately.
- App Check is **off** on `/auth/**` but **on** for `/auth/profile/sync` (the user
  exists by then). If `profile/sync` returns `401 APP_CHECK_FAILED` in dev, set
  `DISABLE_APP_CHECK=true` on the server or finish App Check setup.
- A brand-new Google user may hit an authed route before `profile/sync` completes;
  call `profile/sync` immediately after `signInWithCredential` and await it before
  navigating into the app.
- **`success: true` from `/auth/password/forgot` (and from `/auth/otp/resend` with
  `type: "reset"`) does not mean the email exists.** Both mask a missing account
  behind a generic "If an account exists…" message to prevent enumeration. Don't
  gate navigation on it or surface "no such account" there.
