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
GET /voice/token?voiceId=Aoede&maxSecs=1800
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
→ 200 { "data": { "token": "auth_tokens/…", "sessionId": "3f9c…", "allowedSeconds": 1800, "model": "gemini-3.8-live" } }
→ 402 { "error": { "code": "PAYMENT_REQUIRED", "message": "Insufficient credit for voice session" } }
→ 429 { "error": { "code": "RATE_LIMITED", "message": "Too many token requests. Please wait." } }  (includes Retry-After header)
→ 500 { "error": { "code": "INTERNAL", "message": "Failed to create ephemeral token" } }
```

Query parameters (`voiceId`, `maxSecs`) are optional. The server allowlists `voiceId`
against the supported voice personas (deriving the persona name strictly server-side),
uses stored preferences by default, and `maxSecs` can only lower the allowance from
the user's free voice seconds and balance.

The real API key never reaches the device. The token lasts **60 minutes** and
keeps the new-session window open for **35 minutes** — long enough to cover a full
30-minute call plus a 5-minute reconnect buffer.

> **The system prompt is locked inside the token server-side.** You do NOT need to
> send `systemInstruction` in `live.connect()`. The backend binds and locks the legal
> advisor instruction directly inside the token's `liveConnectConstraints`. This protects
> the prompt from inspection or client tampering.

> **`sessionId` is server-minted — never generate your own.** `/voice/token` is
> stateless in Firestore (no premature `voiceSessions` or `voiceSessionBuffers`
> entry on button tap). Once `live.connect()` opens, sync every 10 seconds to
> `voiceSessionBuffers/{sessionId}` (`status: "active"`, `updatedAt`, `duration`,
> incremental `transcripts`) matching `use-firebase-sync.ts`. `POST /voice/billing`
> settles into `voiceSessions/{sessionId}` via shared `recordVoiceSession` and
> deletes the buffer.

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
  apiKey: token, // the ephemeral token, not the real key
  httpOptions: { apiVersion: "v1beta" }, // matches the token's server apiVersion
});

// NOTE: systemInstruction and realtimeInputConfig (VAD tuning) are embedded
// and locked inside the server-minted token via lockAdditionalFields: [].
// The Gemini Live server enforces them automatically.
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: preferedVoiceId || "Aoede" },
    },
  },
  tools: [{ googleSearch: {} }],
  inputAudioTranscription: {}, // → msg.serverContent.inputTranscription (what the user said)
  outputAudioTranscription: {}, // → msg.serverContent.outputTranscription (what the AI said)
  contextWindowCompression: {
    triggerTokens: "48000",
    slidingWindow: { targetTokens: "24000" },
  },
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
  for (let i = 0; i < pcmBytes.length; i++)
    binary += String.fromCharCode(pcmBytes[i]);
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
  if (msg.serverContent?.interrupted) {
    stopPlayback();
    finalizeTurns();
  }

  // Session rotation handle — persist only when resumable.
  if (
    msg.sessionResumptionUpdate?.newHandle &&
    msg.sessionResumptionUpdate.resumable !== false
  ) {
    previousHandle = msg.sessionResumptionUpdate.newHandle;
  }
  // Server asks to rotate the socket.
  // If we've hit the 30-minute cap, close permanently and settle billing once.
  // Otherwise, defer rotation until the active model turn finishes (within timeLeft)
  // so the AI isn't cut off mid-sentence, then reconnect with previousHandle.
  if (msg.goAway) {
    if (duration >= 1800) {
      session.close();
      reconnectAllowed = false; // prevent further reconnect attempts
      settleBilling(); // call exactly once at cap
    } else if (!isModelTurnActive) {
      session.close(); // will reconnect with previousHandle (see connect logic)
    } else {
      pendingGoAwayRotation = true; // close on turnComplete or before timeLeft expires
    }
  }

  // Audio out.
  for (const part of msg.serverContent?.modelTurn?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith("audio/pcm")) {
      enqueuePcm24k(part.inlineData.data); // base64 → decode → schedule
    }
  }

  // Live transcripts.
  const inT = msg.serverContent?.inputTranscription?.text; // user speech → text
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
- **Session resumption & 30-minute continuity:** persist `sessionResumptionUpdate.newHandle`
  whenever `resumable !== false`. Because Google Live connections rotate every ~10 minutes,
  proactively pre-warm a fresh single-use token every **8.5 minutes (510 s)** and immediately
  on `goAway`. On clean `goAway` rotation (while `duration < 1800`), hand off at **0 ms**
  using the pre-warmed token and `config.sessionResumption = { handle: previousHandle }`,
  buffering up to ~2 s of active user speech across the handoff so words are never lost.
  On error closes, force a fresh token with exponential backoff (500 ms × attempt, capped 5 s,
  max ~5 attempts). Keep the requested `maxSecs` consistent across reconnects so the server-locked
  `systemInstruction` never drifts mid-call.
- **Time Remaining System Notifications:** The prompt explicitly forbids the AI from
  guessing time and requires text notifications to alert the user. Send these via
  `sendClientContent` as `duration` increments (`turnComplete: false` for 5m/2m when
  the AI is speaking so it doesn't interrupt mid-sentence, `turnComplete: true` for 10s):
  ```ts
  const limit = allowedSeconds || 1800;
  // At 5 minutes remaining (if session > 10m):
  if (duration === limit - 300 && limit > 600) {
    session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: "SYSTEM NOTIFICATION: 5 minutes remaining until the session limit. Please inform the user gracefully." }] }],
      turnComplete: !isModelTurnActive,
    });
  }
  // At 2 minutes remaining (if session > 5m):
  if (duration === limit - 120 && limit > 300) {
    session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: "SYSTEM NOTIFICATION: 2 minutes remaining. Please inform the user and continue your response uninterrupted." }] }],
      turnComplete: !isModelTurnActive,
    });
  }
  // At final 10 seconds:
  if (duration === limit - 10) {
    session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: "SYSTEM NOTIFICATION: The session limit has been reached. Please gracefully inform the user that time is over, thank them for their time, and warmly invite them to call back if they have any further legal concerns. Be creative and as polite as possible in your final 10 seconds." }] }],
      turnComplete: true,
    });
  }
  ```
- **Duration cap:** sessions are capped at `allowedSeconds` (maximum **1800 s / 30 min**). Stop reconnecting
  once `duration >= limit`; end and settle the session.

## Step 6 — settle billing (idempotent)

Use the **`sessionId` you received from `GET /voice/token`** (Step 1) and keep
syncing `voiceSessionBuffers/{sessionId}` while connected (`status: "active"`,
`updatedAt`, `duration`, and incremental `transcripts` matching web's
`useFirebaseSync`).

```ts
// From Step 2 — one sessionId per call, minted server-side.
const { token, sessionId } = await apiFetch<{
  token: string;
  sessionId: string;
}>("/voice/token");
```

When the call ends with `duration > 0` — user hangs up, or the app backgrounds — post the settle:

```
POST /voice/billing            # App Check NOT required (see below)
Authorization: Bearer <id-token>
Content-Type: application/json
{
  "sessionId": "<the sessionId from /voice/token>",
  "duration": 137.4,                          # billable call duration (> 0 seconds)
  "transcripts": [                            # remaining unsynced turns ("user" | "AI")
    { "role": "user", "content": "…" },
    { "role": "AI",   "content": "…" }
  ]
}
→ 200 { "data": { "voiceSessionId": "…" } }
→ 400 { "error": { "code": "BAD_REQUEST",     "message": "Nothing to bill or summarize." } }
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
  if (res.status === 401) return; // expired token — discard, do NOT sign out
  if (res.status === 404) return; // session belongs to a different uid — drop silently
  if (res.status === 503) return scheduleRetry(body); // retryable
  if (!res.ok) reportError(await res.json().catch(() => null));
}
```

> **`duration` and `transcripts` merge cleanly with `voiceSessionBuffers`.**
> `recordVoiceSession` takes `Math.max(Math.floor(duration), bufferDuration)`,
> merges `[...bufferTranscripts, ...clientTranscripts]`, writes `voiceSessions/{sessionId}`
> using the exact web schema (`audioUrl: ""` initially, updated after upload with `{ audioUrl }` only),
> deducts credits idempotently, and deletes `voiceSessionBuffers/{sessionId}`.

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
duplicate settle (e.g. background _and_ hang-up both fire) charges once. A `503`
means retryable — retry with backoff; a `200` means settled, so **disarm any retry
fallback**. There is also a server-side finalizer, so a fully missed call is
eventually recovered — but always attempt the settle.

Transcript limits (server-enforced): ≤1000 entries, ≤10,000 chars each, ≤300,000
chars total. Trim before sending.

## Recommended RN audio stack

| Need                 | First choice                                                                                                                                      | Alternatives                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Mic + playback graph | **`react-native-audio-api`** — Web-Audio-compatible (`AudioContext`, `AudioBufferSourceNode`), so the scheduling code above ports almost verbatim | `react-native-webrtc` (`getUserMedia`) + a native PCM player |
| Raw mic PCM only     | `react-native-live-audio-stream` / `@dr.pogodin/react-native-audio`                                                                               | native `AudioRecord`                                         |
| Downsample 48k→16k   | do it in JS (linear/decimate) on the capture callback                                                                                             | native resampler in a fork                                   |
| Keep screen awake    | `expo-keep-awake` (`useKeepAwake()`)                                                                                                              | `react-native-keep-awake`                                    |

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
  `lockAdditionalFields: []` (which locks every field in `liveConnectConstraints.config`,
  including `systemInstruction`). Client-supplied system instructions
  are ignored by the Live API constraints.
- Fetch the token immediately before the first `live.connect`, keeping `sessionId`
  for buffer sync (`voiceSessionBuffers/{sessionId}` once connected), `sessionResumption`
  reconnects, `POST /voice/billing`, and uploading/linking `audioUrl` on `voiceSessions/{voiceSessionId}`.
- Transcript `role` is **`"AI"` (capitalized)**, not `"assistant"` or `"ai"`.
- Send `duration` in **seconds** (floored server-side, capped at `1800`). Wait until
  settled before uploading/linking `{ audioUrl }` — never write custom fields such as
  `recordingStatus`, `reservationType`, `allowedSeconds`, or `startedAt` to `voiceSessions`.
- Don't attach the App Check header logic to `/voice/billing` in a way that _blocks_
  the request if the token is missing — send Bearer-only and let it through.
- The web mixes recording at 48 kHz for local capture; that's a web-only convenience
  (IndexedDB + `mediabunny`). Mobile has no equivalent requirement — skip local call
  recording unless a product need exists (see the package map for storage options).
- Sessions hard-cap at 30 minutes; surface the remaining time and end gracefully.
