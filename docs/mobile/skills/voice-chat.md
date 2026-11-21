# Voice Chat — Mobile Agent Skill

> The hardest feature to port. The **WebSocket + `@google/genai` session logic is
> portable to RN unchanged**; what must be rebuilt is the **audio I/O** — the web
> version uses Web Audio `AudioWorklet` nodes that don't exist in React Native.
> This guide covers both halves and the billing settle.

## What this covers

- The ephemeral-token → `live.connect` flow (portable).
- The exact `LiveConnectConfig`, model, and message protocol to replicate.
- **Native audio rebuild:** mic capture → 16 kHz Int16 PCM in; 24 kHz PCM out with
  gapless playback; VAD, barge-in, session resumption.
- Settling the session via `POST /voice/billing` on backgrounding (idempotent).
- Recommended RN audio stack + alternatives, and performance tuning.

## Architecture

```
 GET /voice/token ──► { token (60 min), sessionId, allowedSeconds, model }
        │                                  ▲ server mints token with system prompt
        ▼                                    embedded & locked server-side
 @google/genai  live.connect({ model:"gemini-3.8-live", config })
   over the device WebSocket  ◄─────────────────────────────────────────┐
        │                                                                │
   mic ─► 16 kHz Int16 PCM ─► base64 ─► session.sendRealtimeInput(audio) │
        │                                                                │
   AI  ◄─ 24 kHz Int16 PCM ◄─ base64 ◄─ msg.serverContent.modelTurn.parts┘
        │
   on end / app background ─► POST /voice/billing { sessionId, duration, transcripts }
                                                    ▲
                              the SAME sessionId returned by /voice/token
```

Two things are portable as-is: the **`@google/genai` package** (it runs on RN's
WebSocket + Hermes) and **all the session orchestration** (config, resumption,
transcript accumulation). Only the audio graph changes.

## Step 1 — mint the ephemeral token (and get your `sessionId`)

```
GET /voice/token?voiceId=Aoede&voiceName=Evelyn&maxSecs=1800
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
→ 200 { "data": { "token": "auth_tokens/…", "sessionId": "3f9c…", "allowedSeconds": 1800, "model": "gemini-3.8-live" } }
→ 402 { "error": { "code": "PAYMENT_REQUIRED", "message": "Insufficient credit for voice session" } }
→ 500 { "error": { "code": "INTERNAL", "message": "Failed to create ephemeral token" } }
```

Query parameters (`voiceId`, `voiceName`, `maxSecs`) are optional — the server falls back
to the user's stored preference and credit balance.

The real API key never reaches the device. The token lasts **60 minutes** and
keeps the new-session window open for **35 minutes** — long enough to cover a full
30-minute call plus a 5-minute reconnect buffer. **Fetch it immediately before
connecting**, not at app start. You may cache it client-side for up to 30 minutes
(the web client does exactly this); just ensure you always have a valid token before
calling `live.connect`.

> **The system prompt is locked inside the token server-side.** You do NOT need to
> send `systemInstruction` in `live.connect()`. The backend binds and locks the legal
> advisor instruction directly inside the token's `liveConnectConstraints`. This protects
> the prompt from inspection or client tampering.

> **`sessionId` is server-minted — never generate your own.** This call also
> pre-creates the server-authoritative voice-session **reservation** in Firestore
> (`voiceSessions/{sessionId}`, `status: "ACTIVE"`, with the server start time that
> billing is computed from). `POST /voice/billing` looks that reservation up and
> returns **400 `Voice session reservation not found`** for any id it did not mint —
> so a client-generated UUID means the call is never billed and never saved. Keep the
> returned `sessionId` for the lifetime of the call and send it back at settle time.

This endpoint also performs the **pre-flight credit check**: a user with no free
voice seconds and insufficient balance gets **402** here, before any audio is
captured. Surface a top-up prompt on 402 rather than opening the socket.

## Step 2 — connect

```ts
import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";

const { token, sessionId, model } = await apiFetch<{
  token: string;
  sessionId: string;
  allowedSeconds: number;
  model: string;
}>("/voice/token");
// Keep `sessionId` for the whole call — it is what /voice/billing settles against.

const ai = new GoogleGenAI({
  apiKey: token,                          // the ephemeral token, not the real key
  httpOptions: { apiVersion: "v1beta" },  // matches the token's server apiVersion
});

// NOTE: systemInstruction is omitted because it is embedded and locked inside
// the server-minted token. The Gemini Live server enforces it automatically.
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  temperature: 0,
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: preferedVoiceId || "Aoede" },
    },
  },
  tools: [{ googleSearch: {} }],
  inputAudioTranscription: {},   // → msg.serverContent.inputTranscription (what the user said)
  outputAudioTranscription: {},  // → msg.serverContent.outputTranscription (what the AI said)
  contextWindowCompression: { slidingWindow: {} },
  // On reconnect only:
  // sessionResumption: { handle: previousHandle },
};

const session = await ai.live.connect({
  model: model || "gemini-3.8-live",
  config,
  callbacks: { onopen, onmessage, onerror, onclose },
});
```

The system instruction is completely server-managed and enforced by the token's constraints.
You do not need to fetch, store, or bundle any prompt instructions in the mobile app.

## Step 3 — mic → 16 kHz Int16 PCM → send

The model wants **mono 16 kHz signed-16-bit little-endian PCM**, base64-encoded:

```ts
// pcm: Int16Array (or its ArrayBuffer) at 16 kHz, mono
function sendMicChunk(session, pcmBytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < pcmBytes.length; i++) binary += String.fromCharCode(pcmBytes[i]);
  const base64 = btoa(binary);
  session.sendRealtimeInput({
    audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
  });
}
```

Most mic capture libraries emit 44.1/48 kHz. **Downsample to 16 kHz** and convert to
Int16 before sending. Chunk ~40 ms (640 samples at 16 kHz) — the web worklet's
`bufferSize` — for a good latency/overhead balance.

**Voice Activity Detection (VAD):** the web computes RMS per chunk and gates on a
threshold (`0.005`) with an 800 ms release, only marking "speaking" above it. Port
this to avoid streaming silence and to drive the mic-level UI. Gemini also does
server-side VAD, so client VAD is an optimization, not a correctness requirement.

## Step 4 — receive 24 kHz PCM → gapless playback

AI audio arrives as base64 Int16 PCM at **24 kHz** inside model-turn parts:

```ts
function onmessage(msg) {
  // Barge-in: user interrupted the AI — stop playback immediately (see Step 5).
  if (msg.serverContent?.interrupted) { stopPlayback(); finalizeTurns(); }

  // Session rotation handle — persist for reconnect.
  if (msg.sessionResumptionUpdate?.newHandle) {
    previousHandle = msg.sessionResumptionUpdate.newHandle;
  }
  // Server asks to rotate the socket.
  // If we've hit the 30-minute cap, close permanently and settle billing once.
  // Otherwise, reconnect with the saved handle.
  if (msg.goAway) {
    if (duration >= 1800) {
      session.close();
      reconnectAllowed = false;  // prevent further reconnect attempts
      settleBilling();            // call exactly once at cap
    } else {
      session.close();           // will reconnect with previousHandle (see connect logic)
    }
  }

  // Audio out.
  for (const part of msg.serverContent?.modelTurn?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith("audio/pcm")) {
      enqueuePcm24k(part.inlineData.data); // base64 → decode → schedule
    }
  }

  // Live transcripts.
  const inT = msg.serverContent?.inputTranscription?.text;   // user speech → text
  const outT = msg.serverContent?.outputTranscription?.text; // AI speech → text
  if (inT) accumulateUser(inT);
  if (outT) accumulateAI(outT);
  if (msg.serverContent?.turnComplete) finalizeTurns();
}
```

**Gapless playback is the crux.** Chunks arrive faster than real time and must play
back-to-back without clicks. Maintain a running "next start time" and schedule each
buffer at that time, then advance it by the buffer's duration:

```ts
// react-native-audio-api (Web-Audio-compatible)
let nextStart = 0;
function enqueuePcm24k(base64: string) {
  const int16 = decodeBase64ToInt16(base64);
  const float32 = Float32Array.from(int16, (s) => s / 32768); // Int16 → Float
  const buf = ctx.createBuffer(1, float32.length, 24000);
  buf.getChannelData(0).set(float32);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  const now = ctx.currentTime;
  nextStart = Math.max(nextStart, now);
  src.start(nextStart);
  nextStart += buf.duration;
}
```

On barge-in / interruption, cancel every scheduled source and reset `nextStart = 0`.

## Step 5 — barge-in, resumption, duration cap & time notifications

- **Barge-in:** when `msg.serverContent.interrupted` fires, stop and flush the
  playback queue immediately so the AI goes quiet the instant the user speaks.
- **Session resumption:** persist `sessionResumptionUpdate.newHandle`. On `goAway`
  or a non-1000/1005 socket close **while `duration < 1800`**, reconnect and set
  `config.sessionResumption = { handle: previousHandle }` — the conversation
  continues seamlessly. Back off (500 ms × attempt, capped 5 s), max ~5 attempts.
- **Time Remaining System Notifications:** The prompt explicitly forbids the AI from
  guessing time and requires text notifications to alert the user. Send these realtime
  text inputs as `duration` increments:
  ```ts
  const limit = allowedSeconds || 1800;
  // At 5 minutes remaining (if session > 10m):
  if (duration === limit - 300 && limit > 600) {
    session.sendRealtimeInput({ text: "SYSTEM NOTIFICATION: 5 minutes remaining until the session limit. Please inform the user gracefully." });
  }
  // At 2 minutes remaining (if session > 5m):
  if (duration === limit - 120 && limit > 300) {
    session.sendRealtimeInput({ text: "SYSTEM NOTIFICATION: 2 minutes remaining. Please inform the user and continue your response uninterrupted." });
  }
  // At final 10 seconds:
  if (duration === limit - 10) {
    session.sendRealtimeInput({ text: "SYSTEM NOTIFICATION: The session limit has been reached. Please gracefully inform the user that time is over, thank them for their time, and warmly invite them to call back if they have any further legal concerns. Be creative and as polite as possible in your final 10 seconds." });
  }
  ```
- **Duration cap:** sessions are capped at `allowedSeconds` (maximum **1800 s / 30 min**). Stop reconnecting
  once `duration >= limit`; end and settle the session.

## Step 6 — settle billing (idempotent)

Use the **`sessionId` you received from `GET /voice/token`** (Step 1). Do **not**
generate one: the server already created the reservation under its own id, and
billing rejects any other value with `400 Voice session reservation not found`.

```ts
// From Step 2 — one sessionId per call, minted server-side.
const { token, sessionId } = await apiFetch<{ token: string; sessionId: string }>(
  "/voice/token",
);
```

When the call ends — user hangs up, or the app backgrounds — post the settle:

```
POST /voice/billing            # App Check NOT required (see below)
Authorization: Bearer <id-token>
Content-Type: application/json
{
  "sessionId": "<the sessionId from /voice/token>",
  "duration": 137.4,                          # OPTIONAL, telemetry only — see note
  "transcripts": [                            # role is "user" | "AI" (capitalized)
    { "role": "user", "content": "…" },
    { "role": "AI",   "content": "…" }
  ],
  "preferedVoice": {                          # optional
    "preferedVoiceId": "Zephyr",
    "preferedVoiceName": "Zephyr"
  },
  "userName": "Ada"                           # optional
}
→ 200 { "data": { "voiceSessionId": "…" } }
→ 400 { "error": { "code": "BAD_REQUEST",     "message": "Voice session reservation not found" } }
→ 400 { "error": { "code": "BAD_REQUEST",     "message": "Invalid request body" } }
→ 401 { "error": { "code": "UNAUTHENTICATED", "message": "Authentication required." } }   # no/invalid Bearer token
→ 404 { "error": { "code": "NOT_FOUND",       "message": "Voice session not found." } }   # session belongs to a different uid
→ 503 { "error": { "code": "INTERNAL",        "message": "Failed to process billing" } }   # retryable
→ 500 { "error": { "code": "INTERNAL",        "message": "Failed to process billing" } }   # not retryable
```

`sessionId` must match `^[A-Za-z0-9_-]{1,64}$` (the server-minted value always
does). A **401** means no or invalid Bearer token. A **404** means the session
document exists but belongs to a different uid — the endpoint deliberately returns
404 (not 403) to avoid leaking that the session exists.

> **⚠️ Do not settle billing through `apiFetch`.** The reference wrapper in
> `error-handling.md` calls `auth().signOut()` on any `401 UNAUTHENTICATED` that
> survives one retry. `POST /voice/billing` returns `401` only when the Bearer
> token itself is missing or expired — that is correct sign-out territory. However,
> it returns `404 NOT_FOUND` when the session belongs to a different uid, so the
> sign-out trap no longer fires for mismatched sessions. Despite this, use a
> dedicated helper (or a flag that suppresses the sign-out) so the billing path
> stays explicitly clear of the global auth recovery flow.

```ts
// Bearer-only. No sign-out on 401/404 — see the warning above.
async function settleVoiceBilling(body: VoiceBillingBody) {
  const user = auth().currentUser;
  if (!user) return; // nothing to settle against
  const res = await fetch(`${BASE_URL}/voice/billing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return;               // expired token — discard, do NOT sign out
  if (res.status === 404) return;               // session belongs to a different uid — drop silently
  if (res.status === 503) return scheduleRetry(body); // retryable
  if (!res.ok) reportError(await res.json().catch(() => null));
}
```

> **`duration` is optional and advisory.** The server ignores it for money: it
> computes the billable duration from the reservation's own `startedAt` timestamp,
> clamped to `MAX_VOICE_SESSION_SECONDS` (1800). Send it for telemetry if you like;
> omitting it changes nothing about what the user is charged.

Fire it from an `AppState` `background`/`inactive` transition (RN has no
`sendBeacon`). **`/voice/billing` deliberately does not require App Check** — a
backgrounded app often can't obtain an App Check token in time, and billing must not
be dropped. Send it **Bearer-only**.

```ts
import { AppState } from "react-native";

AppState.addEventListener("change", (state) => {
  if ((state === "background" || state === "inactive") && callActive) {
    settleBilling(); // best-effort; safe to also call on explicit hang-up
  }
});
```

**Idempotency & retry:** `recordVoiceSession` is idempotent on `sessionId`, so a
duplicate settle (e.g. background *and* hang-up both fire) charges once. A `503`
means retryable — retry with backoff; a `200` means settled, so **disarm any retry
fallback**. There is also a server-side finalizer, so a fully missed call is
eventually recovered — but always attempt the settle.

Transcript limits (server-enforced): ≤1000 entries, ≤10,000 chars each, ≤300,000
chars total. Trim before sending.

## Recommended RN audio stack

| Need | First choice | Alternatives |
|---|---|---|
| Mic + playback graph | **`react-native-audio-api`** — Web-Audio-compatible (`AudioContext`, `AudioBufferSourceNode`), so the scheduling code above ports almost verbatim | `react-native-webrtc` (`getUserMedia`) + a native PCM player |
| Raw mic PCM only | `react-native-live-audio-stream` / `@dr.pogodin/react-native-audio` | native `AudioRecord` |
| Downsample 48k→16k | do it in JS (linear/decimate) on the capture callback | native resampler in a fork |
| Keep screen awake | `expo-keep-awake` (`useKeepAwake()`) | `react-native-keep-awake` |

`react-native-audio-api` is the closest analogue to the web implementation — it
gives you a real `AudioContext` so the mic-worklet-equivalent (an
`AudioWorkletNode` or script processor) and the gapless output scheduler both map
directly. Prefer it unless you already depend on WebRTC.

## Performance notes

- **Echo cancellation & noise suppression:** enable the platform AEC on the capture
  session (WebRTC's `getUserMedia({ audio: { echoCancellation: true } })`, or the
  native `VoiceProcessingIO` unit on iOS / `VOICE_COMMUNICATION` source on Android).
  Without it the AI hears its own output and interrupts itself.
- **Downsample once, cheaply.** Capture at the device's native rate, then decimate
  to 16 kHz mono in the audio callback. Don't ship 48 kHz to the model.
- **Chunk size ~40 ms.** Matches the web worklet (640 samples @ 16 kHz). Smaller =
  more socket overhead; larger = more latency.
- **Schedule, don't `play()` per chunk.** The running-`nextStart` scheduler is what
  makes playback gapless; calling a fire-and-forget play per chunk clicks and drifts.
- **Reset the scheduler on every interruption/turn boundary**, or old audio plays
  over the new turn.
- **Keep the screen awake** for the whole call (`useKeepAwake`) — a locked screen
  suspends the audio graph and the socket.
- **Transfer, don't copy** large PCM buffers between native and JS where the library
  allows it, to avoid GC churn on long calls.

## Gotchas

- `httpOptions.apiVersion` **must match the token's version** (`"v1beta"`), and the
  model string should be `"gemini-3.8-live"` (as returned in the `/voice/token` payload).
- **Never pass `systemInstruction` in `LiveConnectConfig`.** The legal advisor prompt
  is securely embedded and locked inside the ephemeral token on the server using
  `lockAdditionalFields: ["systemInstruction"]`. Client-supplied system instructions
  are ignored by the Live API constraints.
- The token's new-session window is **35 minutes** — you may cache a minted token
  for up to **30 minutes** (the web client does exactly this). Mint it once right
  before the first `live.connect`; on reconnect within the same call, reuse the
  cached token rather than fetching a new one. The 30-minute cache budget aligns
  with the 30-minute call cap, so a fresh-minted token at the start of a call
  is always valid for the full duration.
- **Never generate the `sessionId` client-side.** It comes from `GET /voice/token`,
  which reserves it server-side; any other value fails billing with
  `400 Voice session reservation not found`, leaving the call unbilled and unsaved.
  No `uuid` / `react-native-get-random-values` dependency is needed for this.
- One `/voice/token` call = one billable session. Don't reuse a `sessionId` across
  separate calls, and don't fetch a fresh token mid-call just to reconnect — use
  `sessionResumption` with the saved handle instead (Step 5), which keeps the same
  `sessionId`.
- Transcript `role` is **`"AI"` (capitalized)**, not `"assistant"` or `"ai"`.
- `duration` is **optional telemetry** — the server bills from its own reservation
  timestamp. If you do send it, use **seconds** (a float is fine), never milliseconds.
- Don't attach the App Check header logic to `/voice/billing` in a way that *blocks*
  the request if the token is missing — send Bearer-only and let it through.
- The web mixes recording at 48 kHz for local capture; that's a web-only convenience
  (IndexedDB + `mediabunny`). Mobile has no equivalent requirement — skip local call
  recording unless a product need exists (see the package map for storage options).
- Sessions hard-cap at 30 minutes; surface the remaining time and end gracefully.
