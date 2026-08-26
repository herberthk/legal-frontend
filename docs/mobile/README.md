# Legal Adviser — Mobile API & React Native Build Guide

This directory is the **contract and build manual** for a React Native (Expo)
client of Legal Adviser. It is written to be read by an AI coding agent: every
endpoint, request/response shape, auth rule, and platform-specific gotcha needed
to build the mobile app is here.

- **`skills/*.md`** — one focused guide per feature, and the **source of truth** for request/response shapes. Each has: description · endpoints · request/response · RN implementation (with code) · package alternatives · best practices · gotchas.
- **§5 below** — the complete route index: every `/api/v1` endpoint, its auth requirements, and which skill documents it.

> There is deliberately **no `openapi.yaml`**. The prose skills are hand-verified
> against the route handlers; a second generated spec would drift from them silently
> and there'd be no way to tell which one was lying. Treat the skill docs plus the
> §5 index as the contract, and the route handlers under `app/api/v1/**` as the
> final arbiter.

> The web app is unchanged. Mobile consumes the **same server logic** through a
> new, versioned HTTP surface (`/api/v1`). Web keeps authenticating by session
> cookie; mobile authenticates by Firebase **ID token**. Nothing in the web
> runtime depends on these routes.

---

## 1. Base URL

| Environment | Base URL |
|---|---|
| Production | `https://legaladviser.netbritz.com/api/v1` |
| Local (iOS simulator) | `http://localhost:3000/api/v1` |
| Local (Android emulator) | `http://10.0.2.2:3000/api/v1` |
| Local (physical device) | `http://<your-LAN-ip>:3000/api/v1` |

Put this in a single config module (`EXPO_PUBLIC_API_BASE_URL`) and never
hard-code it per call.

---

## 2. Authentication model

The web app's source of truth is an HTTP-only `session` cookie. React Native has
no browser cookie jar, so the mobile surface uses the **Firebase ID token**
instead:

```
Authorization: Bearer <firebase-id-token>
```

- The client signs in with the Firebase Auth SDK (email/password, custom token,
  or Google), then calls `user.getIdToken()` and sends it on every request.
- The server verifies it with `auth.verifyIdToken(idToken, /* checkRevoked */ true)`
  — the same Admin SDK trust boundary the web uses for its session cookie. A
  signed-out or disabled account is rejected server-side.
- ID tokens expire after ~1 hour. **Always fetch a fresh token per request**
  (the SDK caches and only hits the network when near expiry) rather than storing
  one. See `skills/authentication.md` and `skills/error-handling.md` (401 → refresh & retry).

**Never send a uid in a request body to identify the caller.** Every route
derives identity from the verified token. Bodies that include a `userId` for the
caller are ignored; identity-bearing writes (payments, tickets, FCM tokens) stamp
the token's uid server-side.

---

## 3. App Check

All authenticated routes additionally require a **Firebase App Check** token
proving the request comes from the genuine app binary:

```
X-Firebase-AppCheck: <app-check-token>
```

- Enforced by default on every authenticated route.
- **Not** required on the pre-auth `/auth/**` routes (no user yet — they rely on
  in-action rate limiting) or on `POST /voice/billing` (fired from a backgrounded
  app where a token may be unobtainable; billing must not be lost).
- Local development bypasses App Check when the server env has
  `DISABLE_APP_CHECK=true` in non-production environments (`NODE_ENV !== "production"`).
  In non-production, missing or unverified debug tokens also softly fall back when App
  Check keys are not configured. With bypass/fallback on you can omit the header entirely.

Full setup (App Attest / DeviceCheck on iOS, Play Integrity on Android) is in
`skills/app-check.md`. **Read it before wiring real requests** — a missing App
Check token returns `401 APP_CHECK_FAILED`, not a network error, and is easy to
misdiagnose.

---

## 4. Request & response conventions

### Standard JSON envelope

Every JSON route returns one of two shapes:

```jsonc
// success
{ "data": <payload> }

// error
{ "error": { "code": "NOT_FOUND", "message": "Transaction not found." } }
```

Error `code` is one of:
`UNAUTHENTICATED` · `APP_CHECK_FAILED` · `PAYMENT_REQUIRED` · `BAD_REQUEST` ·
`NOT_FOUND` · `INTERNAL`. (`FORBIDDEN` and `RATE_LIMITED` are declared in the
`ApiErrorCode` union but no route emits them — see `skills/error-handling.md`.)

HTTP status is meaningful and mapped to the code (400/401/402/404/500/503). A
route that wraps an action which itself returns `{ success, ... }` puts that whole
object inside `data` — inspect `data.success` for the operation result, and the
HTTP status for transport/auth/credit outcomes.

> **500 vs 503**: both carry `code: "INTERNAL"`. **500** means a non-retryable
> server fault (bug, unexpected Firestore error). **503** means a retryable
> billing/resource failure — wait briefly and retry the same request with the
> same idempotency key.

### Three deliberate exceptions

These mirror the web routes byte-for-byte so the AI logic stays single-sourced:

| Route | Shape | Why |
|---|---|---|
| `POST /chat` | **SSE stream** (`text/event-stream`, `x-vercel-ai-ui-message-stream: v1`, `data:` frames, `[DONE]`) | consumed by the Vercel AI SDK client |
| `POST /review` | `{ success, review }` on success; `{ error: string }` on failure | matches web multipart handler |
| errors on `/chat` & `/review` | `{ "error": "<string>" }` (not the `{error:{code,message}}` envelope) | the AI SDK expects a flat string |

`skills/chat-streaming.md`, `skills/document-review.md`, and
`skills/error-handling.md` cover these.

### Standard headers on every authenticated call

```
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>   # omit only where noted
Content-Type: application/json            # except multipart /review
```

---

## 5. Route index

Grouped by the skill that documents it. All paths are relative to the base URL.

### Auth & account — `skills/authentication.md`, `skills/account-and-history.md`
| Method | Path | App Check | Notes |
|---|---|---|---|
| POST | `/auth/signup/initiate` | off | `{name,email,password}` → sends OTP |
| POST | `/auth/signup/complete` | off | `{email,otp}` → `{uid, customToken}` |
| POST | `/auth/password/forgot` | off | `{email}` → sends reset OTP |
| POST | `/auth/password/verify` | off | `{email,otp}` → **required before reset** |
| POST | `/auth/password/reset` | off | `{email,newPassword}` |
| POST | `/auth/otp/resend` | off | `{email, type:"signup"\|"reset"}` |
| POST | `/auth/profile/sync` | on | post-OAuth Firestore profile bootstrap |
| GET | `/me` | on | full profile + balance ("who am I") |
| PATCH | `/me` | on | `{name?, avatar?}` |
| PATCH | `/me/voice-preference` | on | `{preferedVoiceId, preferedVoiceName}` |

### AI features — `skills/chat-streaming.md`, `skills/document-review.md`, `skills/voice-chat.md`, `skills/transcription.md`
| Method | Path | App Check | Notes |
|---|---|---|---|
| POST | `/chat` | on | SSE stream; header `x-chat-id` is **required** — a missing one is a 400 |
| POST | `/review` | on | multipart `file`; structured review |
| POST | `/reviews` | on | persist a completed review (upload `fileUrl` to Storage first) |
| GET | `/voice/token` | on | ephemeral Gemini Live token **+ server-minted `sessionId`** |
| POST | `/voice/billing` | **off** | settle a voice session (idempotent) |
| POST | `/transcriptions` | on | `{base64Data, mimeType, formatMode, fileName}` — `mimeType` is a 4-value enum (pdf/png/jpeg/webp) |
| POST | `/transcriptions/records` | on | persist an edited transcript |

### History & records — `skills/account-and-history.md`
| Method | Path |
|---|---|
| GET · POST | `/chats` |
| GET | `/chats/:id/messages` |
| PATCH · DELETE | `/chats/:id` |
| GET | `/voice/sessions` · `/voice/sessions/:id` |
| GET | `/reviews` · `/reviews/:id` · POST `/reviews` · DELETE `/reviews/:id` |
| GET | `/transcriptions` · `/transcriptions/:id` · DELETE `/transcriptions/:id` |

### Billing, usage & payments — `skills/billing-and-usage.md`, `skills/payments-stripe.md`, `skills/payments-mobile-money.md`
| Method | Path | Notes |
|---|---|---|
| GET | `/billing/can-send` | pre-flight `{canSend, reason}` |
| GET | `/usage` · `/usage/chart` · `/usage/free-credits` | metered usage |
| GET | `/transactions` · `/transactions/:id` | wallet history |
| POST | `/payments/stripe/intent` | `{amountInDollars}` → `clientSecret` |
| POST | `/payments/momo/verify` | `{msisdn}` → registered name |
| POST | `/payments/momo/deposit` | `{msisdn, amount, idempotencyKey, userName?}` → `{reference, transactionId, status}` — **`idempotencyKey` required**; 400 = terminal, 503 = retry same key |
| GET | `/payments/status/:reference` | poll deposit status |

### Notifications & support — `skills/push-notifications.md`, `skills/support.md`
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` · `/notifications/unread` | list / bell preview |
| POST | `/notifications/register-device` | `{token}` FCM registration |
| DELETE | `/notifications/device` | `{token}` on logout |
| POST | `/notifications/:id/read` · `/notifications/read-all` | |
| DELETE | `/notifications/:id` | |
| POST · GET | `/support/tickets` | create / list |
| GET · POST | `/support/tickets/:id/messages` | thread / reply |
| GET | `/support/help-articles` | FAQ, `?category=` |

> **Login/logout have no server route** — they are pure client-side Firebase Auth
> in RN. Provider **webhooks** (`/api/webhooks/*`) are server-to-server and are
> never called by mobile; deposit/Stripe crediting flows through them.
> **Admin** features are out of scope (no mobile admin client).

---

## 6. Web → React Native package map

Every browser-only dependency, with its RN replacement and fallbacks. Detailed
usage is in the relevant skill.

| Web | React Native | Alternative / note |
|---|---|---|
| `firebase` (JS SDK) | `@react-native-firebase/{app,auth,firestore,storage}` | JS SDK also works, but native is needed for FCM/App Check |
| `firebase/messaging` + service worker | `@react-native-firebase/messaging` | native push + `setBackgroundMessageHandler` |
| App Check reCAPTCHA | `@react-native-firebase/app-check` | App Attest/DeviceCheck (iOS) · Play Integrity (Android) |
| streaming `fetch` | **`expo/fetch`** | or `react-native-sse` (needs POST-body support) |
| `@ai-sdk/react` `useChat` | same, with `expo/fetch` as the transport | see `chat-streaming.md` |
| `@google/genai` | **same package** (runs on RN's WebSocket/Hermes) | unchanged |
| Web Audio / AudioWorklet | `react-native-audio-api` (Web-Audio-compatible) | or `react-native-webrtc` (`getUserMedia`) + native PCM player |
| PCM ring-buffer playback | `react-native-audio-api` `AudioBufferSourceNode`, or native `AudioTrack`/`AudioQueue` | the trickiest piece — see `voice-chat.md` |
| mic capture | `react-native-audio-api`, or `react-native-live-audio-stream` / `@dr.pogodin/react-native-audio` | must emit 16 kHz Int16 PCM |
| IndexedDB + Web Worker + `mediabunny` (recorder) | `react-native-mmkv`/SQLite + native encoder | or skip client-side recording |
| `crypto.randomUUID` | `react-native-get-random-values` + `uuid`, or `expo-crypto`'s `randomUUID()` | needed for the deposit `idempotencyKey` — **not** for voice `sessionId`, which the server mints |
| `NoSleep` wake-lock | `expo-keep-awake` / `react-native-keep-awake` | keep screen awake during voice |
| `navigator.sendBeacon` | `AppState` `background` + `fetch` | best-effort; server billing is idempotent |
| `@stripe/stripe-js` | `@stripe/stripe-react-native` | confirm the `clientSecret` from `/payments/stripe/intent` |
| `mammoth` / `pdf-parse` | **stays server-side** | RN uploads the raw file; extraction happens on the backend |
| file picker | `expo-document-picker` / `expo-image-picker` | for `/review` and `/transcriptions` |

---

## 7. Getting started (for the build agent)

1. **Read `skills/authentication.md` and `skills/app-check.md` first.** Nothing
   else works until Bearer + App Check are wired.
2. Build a single `apiFetch()` wrapper that: injects the base URL, attaches a
   fresh ID token + App Check token, parses the `{data}`/`{error}` envelope, and
   on `401` refreshes the token once and retries. `skills/error-handling.md` has
   the reference implementation — build it before any feature.
3. Layer features on top, each from its skill: chat (SSE), review (multipart),
   voice (WebSocket + native audio), billing/payments, notifications, support.
4. Verify each feature against its skill doc's "endpoints" block and the §5 route
   index — request shape, response envelope, and every status code listed. When a
   doc and a route handler disagree, the handler in `app/api/v1/**` wins; fix the
   doc.

Firebase project config (the `NEXT_PUBLIC_FIREBASE_*` values) is shared with the
web app — reuse the same Firebase project so tokens verify. Never embed any
server-only key (`*_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `PAWAPAY_API_TOKEN`,
`SMTP_*`) in the mobile app; those live only on the backend.
