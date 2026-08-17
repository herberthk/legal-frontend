# Push Notifications & In-App Inbox — Mobile Agent Skill

> Two related surfaces: **FCM push** (a native banner/badge delivered to the device)
> and the **in-app notification inbox** (a paginated Firestore-backed list the user
> can browse, mark read, and delete). The server may do both for one event — send a
> push *and* write an inbox row. On RN, push uses **`@react-native-firebase/messaging`**
> (the web's service-worker path does not exist on native); the inbox is plain
> enveloped REST.

## What this covers

- Acquiring the FCM token on RN and registering it: `POST /notifications/register-device`.
- Unregistering on logout: `DELETE /notifications/device`.
- The inbox: `GET /notifications`, `GET /notifications/unread`,
  `POST /notifications/:id/read`, `POST /notifications/read-all`,
  `DELETE /notifications/:id`.
- Foreground vs background vs quit-state push handling.

## Push vs. inbox — keep them distinct

| | FCM push | In-app inbox |
|---|---|---|
| Delivery | OS banner/badge, may arrive when app is closed | fetched via REST when the app is open |
| Source | Firebase Cloud Messaging → device | `notifications` Firestore collection |
| RN piece | `@react-native-firebase/messaging` | `apiFetch("/notifications…")` |
| Persistence | ephemeral (the OS notification) | durable rows with `isRead` |

A single server event (e.g. "payment confirmed") typically **writes an inbox row and
sends a push**. Tapping the push should deep-link into the app and let the inbox
provide the durable history.

## FCM setup on React Native

The web uses `firebase/messaging` + a service worker (`app/sw.ts`). **None of that
applies to native RN** — use the native module instead:

```
npx expo install @react-native-firebase/app @react-native-firebase/messaging
```

> This needs a **development build / bare workflow** (config plugin), not Expo Go.
> iOS additionally requires the APNs key uploaded to Firebase and the Push
> Notifications + Background Modes capabilities.

Request permission, get the token, and register it:

```ts
import { Platform, PermissionsAndroid } from "react-native";
import messaging from "@react-native-firebase/messaging";

export async function registerForPush() {
  // 1. On Android 13+ (API 33+), runtime POST_NOTIFICATIONS permission is required:
  if (Platform.OS === "android" && Platform.Version >= 33) {
    const androidGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (androidGranted !== PermissionsAndroid.RESULTS.GRANTED) {
      return;
    }
  }

  // 2. Request messaging authorization (APNs on iOS, FCM settings on Android):
  const status = await messaging().requestPermission();
  const granted =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return;

  // 3. Obtain registration token and register with backend:
  const token = await messaging().getToken();
  await apiFetch("/notifications/register-device", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
```

### Register endpoint

```
POST /notifications/register-device
{ "token": "<fcm-registration-token>" }     // 1–4096 chars
→ 200 { "data": { "success": true } }
```

- The token doc is keyed by the token and stamped with the caller's uid **from the
  Bearer token** (never the body). Upsert-safe: calling it repeatedly is fine.
- **Re-register on refresh.** FCM rotates tokens; subscribe to `onTokenRefresh` and
  POST the new token:

```ts
useEffect(() => messaging().onTokenRefresh((token) => {
  apiFetch("/notifications/register-device", { method: "POST", body: JSON.stringify({ token }) })
    .catch(() => {/* retry later */});
}), []);
```

### Unregister on logout

```
DELETE /notifications/device
{ "token": "<fcm-registration-token>" }
→ 200 { "data": { "success": true } }
→ 404 NOT_FOUND        # token not found OR not owned by caller (IDOR guard)
```

Call this **before** signing out of Firebase Auth, while the ID token is still valid
(the route is authenticated). Also delete the token locally so a stale device stops
receiving pushes:

```ts
const token = await messaging().getToken();
await apiFetch("/notifications/device", { method: "DELETE", body: JSON.stringify({ token }) })
  .catch(() => {/* already gone */});
await messaging().deleteToken();   // optional: force a fresh token next login
```

## Receiving a push (three app states)

### Component-level notification listeners (inside React)

```ts
import { useEffect } from "react";

// Wrap component-level listeners in useEffect so they are registered once and
// cleaned up when the component unmounts — bare declarations outside an effect
// accumulate a new listener on every render.
useEffect(() => {
  // 1. Foreground — the OS does NOT show a banner; you render it yourself.
  const unsubOnMessage = messaging().onMessage(async (msg) => {
    showInAppBanner(msg.notification?.title, msg.notification?.body);
    refetchUnread();                       // keep the bell badge fresh
  });

  // 2. Background (app running, not focused) — tapped notification opens the app.
  const unsubOnOpened = messaging().onNotificationOpenedApp((msg) => deepLink(msg.data?.url));

  // 3. Quit (app not running) — the notification that launched the app.
  messaging().getInitialNotification().then((msg) => { if (msg) deepLink(msg.data?.url); });

  return () => {
    unsubOnMessage();
    unsubOnOpened();
  };
}, []);
```

### Standalone background message handler (root `index.js`, outside React)

```ts
// index.js (must be registered at module root before AppRegistry.registerComponent):
import messaging from "@react-native-firebase/messaging";

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  // Handles data-only messages while backgrounded or quit.
  // Keep this fast and side-effect-light (e.g. updating local notification badge).
});
```

- **Foreground pushes show no OS banner** by default — render your own in-app toast.
- `setBackgroundMessageHandler` must be registered at module top level (in `index.js`), not inside a React component, or Android won't invoke it when quit.
- Use the push `data.url` to deep-link; the durable content lives in the inbox.

## The in-app inbox

```
GET /notifications?page=1&pageSize=20&filter=ALL|UNREAD|READ
→ 200 { "data": { "success": true, "notifications": AppNotification[], "totalCount": 42, "totalPages": 3 } }

GET /notifications/unread          # newest 5 unread — for the bell dropdown/badge
→ 200 { "data": { "success": true, "notifications": AppNotification[] } }

POST   /notifications/:id/read     → { "data": { "success": true } }   # 404 if not owned
POST   /notifications/read-all     → { "data": { "success": true } }   # scoped to caller
DELETE /notifications/:id          → { "data": { "success": true } }   # 404 if not owned
```

- **Page-number pagination** (`page`/`pageSize`, `pageSize` ≤ 50, default 10);
  `filter` defaults to `ALL`. Use `totalPages`/`totalCount` for the pager.
- `GET /notifications/unread` is a fixed **top-5** unread preview for the bell — not
  paginated; use the full list for the inbox screen.
- `:id/read` and `DELETE /:id` are **owner-guarded → 404** on a foreign/unknown id
  (never 403). `read-all` is scoped to the caller server-side (no id needed).

```ts
type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  url?: string;            // deep-link target
  isRead: boolean;
  createdAt: string;       // ISO
}
```

## Best practices

- **Register after login, unregister before logout.** Tie token lifecycle to the auth
  session so pushes follow the signed-in user and stop on sign-out.
- **Handle token refresh** (`onTokenRefresh`) — a token you registered once can rotate;
  a stale token silently stops delivering.
- **Badge from `/notifications/unread`.** Refetch it on push receipt, on app foreground,
  and after marking read, rather than trying to keep a client counter perfectly in sync.
- **Optimistic mark-read/delete** is fine (owner-guarded, returns 404 on foreign ids) —
  reconcile on the response and drop 404s from the local list.
- **Color/iconify by `type`** (`INFO`/`SUCCESS`/`WARNING`/`ERROR`) and deep-link via
  `url` on tap.
- **Don't rely on push for correctness.** Push is best-effort; the inbox (and `/me` for
  balance) is the durable source. A missed push must still be discoverable in-app.

## Performance notes

- Keep `setBackgroundMessageHandler` cheap — it runs in a constrained headless context;
  do a tiny state bump, not a full sync.
- Page the inbox (20/page) and append on scroll; only refetch `unread` for the badge,
  not the whole first page, on every push.

## Gotchas

- **No service worker on native.** The web FCM path (`app/sw.ts`, `firebase/messaging`)
  does not port; use `@react-native-firebase/messaging`. (Expo Web/PWA is the only place
  the SW path would apply.)
- **Requires a dev build**, not Expo Go — the native messaging module needs config
  plugins and, on iOS, an APNs key in Firebase.
- **Foreground = no OS banner.** Render your own; `onMessage` fires but the system tray
  stays empty.
- **Background data handler must be top-level** (`index.js`), registered outside React,
  or it won't fire from a quit state on Android.
- `register-device`/`device` are **authenticated** (App Check on) — register only after
  the user is signed in and you have a valid ID token.
- Deleting an inbox row removes only the Firestore notification; it does **not** recall a
  push already delivered to the OS tray.
