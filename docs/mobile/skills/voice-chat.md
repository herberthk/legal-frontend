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
 GET /voice/token ──► ephemeral token (60 min)
        │
        ▼
 @google/genai  live.connect({ model:"gemini-3.1-flash-live-preview", config })
   over the device WebSocket  ◄─────────────────────────────────────────┐
        │                                                                │
   mic ─► 16 kHz Int16 PCM ─► base64 ─► session.sendRealtimeInput(audio) │
        │                                                                │
   AI  ◄─ 24 kHz Int16 PCM ◄─ base64 ◄─ msg.serverContent.modelTurn.parts┘
        │
   on end / app background ─► POST /voice/billing { sessionId, duration, transcripts }
```

Two things are portable as-is: the **`@google/genai` package** (it runs on RN's
WebSocket + Hermes) and **all the session orchestration** (config, resumption,
transcript accumulation). Only the audio graph changes.

## Step 1 — mint the ephemeral token

```
GET /voice/token
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
→ 200 { "data": { "token": "auth_tokens/…" } }
```

The real API key never reaches the device. The token lasts 60 minutes and allows
5 minutes to open a session. **Fetch it immediately before connecting**, not at app
start.

## Step 2 — connect

```ts
import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";

const { token } = await apiFetch<{ token: string }>("/voice/token");

const ai = new GoogleGenAI({
  apiKey: token,                          // the ephemeral token, not the real key
  httpOptions: { apiVersion: "v1alpha" }, // REQUIRED — must match the token's version
});

const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  temperature: 0,
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: preferedVoiceId || "Zephyr" },
    },
  },
  tools: [{ googleSearch: {} }],
  inputAudioTranscription: {},   // → msg.serverContent.inputTranscription (what the user said)
  outputAudioTranscription: {},  // → msg.serverContent.outputTranscription (what the AI said)
  contextWindowCompression: { slidingWindow: {} },
  systemInstruction: { parts: [{ text: SYSTEM_VOICE_INSTRUCTION }] },
  // On reconnect only:
  // sessionResumption: { handle: previousHandle },
};

const session = await ai.live.connect({
  model: "gemini-3.1-flash-live-preview",
  config,
  callbacks: { onopen, onmessage, onerror, onclose },
});
```

Reuse the web's `LEGAL_SYSTEM_VOICE_CHAT_INSTRUCTION` text (ask the backend owner to
expose it, or embed an equivalent). It bakes in the max-duration sentence.

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
  // Server asks to rotate the socket — close and reconnect with the handle.
  if (msg.goAway && duration < 1800) session.close();

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

## Step 5 — barge-in, resumption, duration cap

- **Barge-in:** when `msg.serverContent.interrupted` fires, stop and flush the
  playback queue immediately so the AI goes quiet the instant the user speaks.
- **Session resumption:** persist `sessionResumptionUpdate.newHandle`. On `goAway`
  or a non-1000/1005 socket close **while `duration < 1800`**, reconnect and set
  `config.sessionResumption = { handle: previousHandle }` — the conversation
  continues seamlessly. Back off (500 ms × attempt, capped 5 s), max ~5 attempts.
- **Duration cap:** sessions are capped at **1800 s (30 min)**. Stop reconnecting
  once `duration >= 1800`; end and settle the session.

## Step 6 — settle billing (idempotent)

Generate a **session id once per call** and reuse it for billing. It must match
`^[A-Za-z0-9_-]{1,64}$` — a UUID qualifies:

```ts
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
const sessionId = uuidv4();
```

When the call ends — user hangs up, or the app backgrounds — post the settle:

```
POST /voice/billing            # App Check NOT required (see below)
Authorization: Bearer <id-token>
Content-Type: application/json
{
  "sessionId": "<uuid>",
  "duration": 137.4,                          # seconds; server floors to whole seconds
  "transcripts": [                            # role is "user" | "AI" (capitalized)
    { "role": "user", "content": "…" },
    { "role": "AI",   "content": "…" }
  ],
  "preferedVoice": { "preferedVoiceId": "…", "preferedVoiceName": "…" },  # optional
  "userName": "Jane"                          # optional
}
→ 200 { "data": { "voiceSessionId": "…" } }
```

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
| Randomness for `sessionId` | `react-native-get-random-values` + `uuid` | `expo-crypto` |

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

- `httpOptions.apiVersion` **must be `"v1alpha"`** on the client `GoogleGenAI`, or
  the ephemeral token is rejected.
- The token is short-lived — mint it right before connecting; don't cache it.
- Transcript `role` is **`"AI"` (capitalized)**, not `"assistant"` or `"ai"`.
- `duration` is **seconds** (a float is fine — the server floors it); do not send
  milliseconds.
- Don't attach the App Check header logic to `/voice/billing` in a way that *blocks*
  the request if the token is missing — send Bearer-only and let it through.
- The web mixes recording at 48 kHz for local capture; that's a web-only convenience
  (IndexedDB + `mediabunny`). Mobile has no equivalent requirement — skip local call
  recording unless a product need exists (see the package map for storage options).
- Sessions hard-cap at 30 minutes; surface the remaining time and end gracefully.
