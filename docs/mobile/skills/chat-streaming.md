# Chat Streaming — Mobile Agent Skill

> Real-time legal chat over Server-Sent Events. The single hard part on RN is that
> the default `fetch` can't stream a POST body's response — you must use
> **`expo/fetch`**. Everything else (the AI SDK client, message shapes) ports
> directly from web.

## What this covers

- The `POST /chat` SSE contract (`x-vercel-ai-ui-message-stream: v1`).
- Consuming it in RN with **`expo/fetch`** + `@ai-sdk/react`'s `useChat`.
- **`x-chat-id` is required** — a missing header is a `400`, not a degraded stream.
- Sending document/image attachments (upload to Storage first).
- Rendering reasoning ("thinking") parts, and a hand-rolled parser fallback.

## Endpoint

```
POST /chat
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
x-chat-id: <chatSessionId>       # REQUIRED for billing + persistence — see gotcha
x-first-message: "true"|"false"  # marks the session's first user turn (for titling)

Body: { "messages": UIMessage[] }   # AI SDK UIMessage array
```

**Response:** an SSE stream, **not** the JSON envelope.

```
HTTP/1.1 200
Content-Type: text/event-stream
x-vercel-ai-ui-message-stream: v1

data: {"type":"text-delta","id":"...","delta":"Under"}
data: {"type":"text-delta","id":"...","delta":" Ugandan"}
data: {"type":"reasoning-delta","id":"...","delta":"The user is asking..."}
...
data: [DONE]
```

**Errors** are a flat string, not the envelope (the AI SDK expects this):

```jsonc
// 400 missing x-chat-id, 403 session unauthorized, 402 out of credit, 401 auth/appcheck, 500 generation error
{
  "error": "Insufficient tokens. This message requires ~1,200 tokens but you only have ~300…",
}
```

The checks run in this exact order, so an earlier failure masks a later one:

| # | Condition | Status | `error` string |
|---|---|---|---|
| 1 | `messages` empty or absent | 400 | `No messages provided.` |
| 2 | `x-chat-id` missing/empty | 400 | `Missing x-chat-id header.` |
| 3 | session missing or belongs to another user | 403 | `Chat session not found or access denied.` |
| 4 | account inactive / no credit | 402 | (reason from `checkUserCanSend`) |
| 5 | estimate exceeds balance | 402 | `Insufficient tokens. …` |
| 6 | generation failure | 500 | `An error occurred during chat generation.` |

An empty `messages` array is therefore a `400 No messages provided.` **before**
`x-chat-id` is even looked at — don't send a "warm-up" request with no messages
expecting a stream.

`/chat` is the **one endpoint that does not use the `{error:{code,message}}`
envelope** — read `error` as a plain string here, and don't route its failures
through the envelope parser in `error-handling.md`.

Map **402 → the top-up flow** (`payments-*` skills). The server estimates cost
_before_ streaming and rejects up front, so a 402 arrives instead of a stream.

## Model & server behavior (for context)

- Model `gemini-3.7-flash`, `temperature: 0`, thinking/reasoning enabled
  (`sendReasoning: true` → you receive `reasoning-delta` parts).
  (`sendReasoning: true` → you receive `reasoning-delta` parts).
- Server keeps only the **last 6 messages** (`MAX_HISTORY_MESSAGES`) — you may send
  full history, but sending the last ~6 saves bandwidth and matches server context.
- The output is smoothed word-by-word server-side, so you get an even cadence — no
  client-side smoothing needed.
- Attachments: **PDF and images stream natively**; **DOCX is extracted to text
  server-side** (via `mammoth`). You never parse documents on the device.

## ⚠️ `x-chat-id` is required

Every `/chat` request **must** carry a non-empty `x-chat-id` header. Without it the
server rejects the request immediately:

```jsonc
// 400 — no stream is opened, nothing is billed, nothing is saved
{ "error": "Missing x-chat-id header." }
```

The header is what the turn is billed against and persisted under, so there is no
"anonymous stream" mode. It is checked **before** the credit pre-flight, and the server
strictly verifies that the session exists in Firestore and belongs to the authenticated `userId`.
A missing header surfaces as `400 Missing x-chat-id header.`, while an invalid or unowned
session ID surfaces as `403 Chat session not found or access denied.`

**Therefore: create a chat session first, then stream into it.**

```ts
// 1. Create (or reuse) a session — see account-and-history.md
const { sessionId } = await apiFetch<{ success: boolean; sessionId: string }>(
  "/chats",
  {
    method: "POST",
    body: JSON.stringify({ title: "New chat" }),
  },
);

// 2. Every /chat request for this conversation sends x-chat-id: sessionId
```

Send `x-first-message: "true"` on the very first user turn of a session (used for
auto-titling), `"false"` after.

## RN implementation — `@ai-sdk/react` + `expo/fetch`

The web uses `@ai-sdk/react`'s `useChat`. It ports to RN unchanged **except** the
transport must use `expo/fetch` (the only RN fetch that streams a response body).

```
npx expo install expo   # provides expo/fetch
npm i ai @ai-sdk/react
```

```ts
// hooks/useLegalChat.ts
import { fetch as expoFetch } from "expo/fetch";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import auth from "@react-native-firebase/auth";
import appCheck from "@react-native-firebase/app-check";
import { useRef, useEffect } from "react";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export function useLegalChat(chatId: string) {
  const isFirst = useRef(true);

  // Reset the first-message flag whenever the active chat session changes so
  // that title generation fires correctly for every new session.
  useEffect(() => {
    isFirst.current = true;
  }, [chatId]);

  return useChat({
    transport: new DefaultChatTransport({
      api: `${BASE_URL}/chat`,
      // expo/fetch streams the SSE body; global fetch buffers it.
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      // Attach a FRESH token + App Check + the chat id on every send.
      headers: async () => {
        const user = auth().currentUser;
        if (!user) {
          // Not signed in yet — surface the error immediately rather than
          // crashing with a null-dereference inside getIdToken().
          throw new Error("Authentication required.");
        }
        const [idToken, ac] = await Promise.all([
          user.getIdToken(),
          appCheck()
            .getToken(false)
            .catch(() => null),
        ]);
        if (!chatId) {
          // The server rejects a missing x-chat-id with 400 before it opens a
          // stream, so fail here with a clearer message than that 400 gives.
          throw new Error("Missing x-chat-id header.");
        }
        const h: Record<string, string> = {
          Authorization: `Bearer ${idToken}`,
          "x-chat-id": chatId,
          "x-first-message": isFirst.current ? "true" : "false",
        };
        if (ac?.token) h["X-Firebase-AppCheck"] = ac.token;
        return h;
      },
      // Send only the tail the server actually uses.
      prepareSendMessagesRequest: ({ messages, headers, api }) => ({
        api,
        headers,
        body: { messages: messages.slice(-6) },
      }),
    }),
    onFinish: () => {
      // Mark first turn completed ONLY when a message response finishes successfully.
      // Failed turns will retain x-first-message: "true" on retry so title generation works.
      isFirst.current = false;
      // Note: The server guarantees that user + assistant messages and usage deductions
      // are committed to Firestore BEFORE the stream closes, so you can safely refresh
      // token balances or refetch history here without race conditions.
    },
    onError: (err) => {
      // Body is flat `{ error: string }`. Inspect status and error message:
      const status = (err as { status?: number }).status;
      const message = err.message || "";

      // 402 Paywall / Insufficient Credits: route to top-up screen
      if (
        status === 402 ||
        message.toLowerCase().includes("insufficient credit") ||
        message.toLowerCase().includes("token")
      ) {
        router.push("/billing/topup");
        return;
      }

      // 403 Session access denied: session missing or belongs to another user
      if (status === 403 || message.toLowerCase().includes("access denied")) {
        showErrorToast("Chat session not found or access denied.");
        return;
      }

      // 401 Auth / App Check failure: prompt sign-in / re-auth
      if (status === 401 || message.toLowerCase().includes("authentication required")) {
        showErrorToast("Session expired. Please sign in again.");
        return;
      }

      // 500 / Network / General Server error: surface clear error message
      showErrorToast(message || "An error occurred while generating a response.");
    },
  });
}
```

### Gating the composer until `chatId` exists

`useChat` has **no `disabled` option** — passing one is silently ignored, so it
cannot be your guard. Block the send at the call site instead: don't render the
composer (or keep the send button disabled) until `chatId` is non-empty.

```tsx
const { messages, sendMessage, status } = useLegalChat(chatId);

<Composer
  // No chatId yet → nothing to bill or persist against, so don't allow a send.
  disabled={!chatId || status === "streaming"}
  onSubmit={(text) => {
    if (!chatId) return;
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
  }}
/>;
```

Better still, create the session on screen mount so `chatId` is set before the
user can type — then the guard never fires in practice.

Render `message.parts`:

```tsx
{
  messages.map((m) => (
    <View key={m.id}>
      {m.parts.map((part, i) => {
        if (part.type === "text")
          return <Markdown key={i}>{part.text}</Markdown>;
        if (part.type === "reasoning")
          return <ThinkingBlock key={i} text={part.text} />; // collapsible "thinking"
        if (part.type === "file")
          return <Attachment key={i} url={part.url} name={part.filename} />;
        return null;
      })}
    </View>
  ));
}
```

## Sending attachments (PDF / image / DOCX)

The chat body carries **HTTPS URLs**, not raw bytes. Upload the file to Firebase
Storage first, then attach a `file` part pointing at the download URL.

```ts
import storage from "@react-native-firebase/storage";
import * as DocumentPicker from "expo-document-picker";

const picked = await DocumentPicker.getDocumentAsync({
  type: [
    "application/pdf",
    "image/*",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
});
if (picked.canceled) return;
const asset = picked.assets[0];

const uid = auth().currentUser!.uid;
const ref = storage().ref(`uploads/${uid}/${Date.now()}-${asset.name}`);
await ref.putFile(asset.uri);
const url = await ref.getDownloadURL();

sendMessage({
  role: "user",
  parts: [
    { type: "text", text: "Review this contract." },
    { type: "file", url, mediaType: asset.mimeType!, filename: asset.name },
  ],
});
```

The server fetches the URL, and for DOCX rewrites the file part into extracted
text before sending to Gemini. PDFs/images pass through natively. Use the same
Firebase Storage bucket as web — `firestore.rules`/Storage rules already scope
`uploads/{uid}/…` to the owner.

### Attachment URL rules (the server enforces all three)

| Rule | Value | If violated |
|---|---|---|
| **Host allowlist** | `firebasestorage.googleapis.com` or `storage.googleapis.com`, over HTTPS | the fetch is refused; the turn continues **without** the attachment |
| **Size** | ≤ **10 MB** (`MAX_ATTACHMENT_BYTES`) | same — attachment dropped, turn proceeds |
| **Fetch timeout** | **15 s** | same — attachment dropped, turn proceeds |

A URL on any other host — an S3 bucket, a CDN, a signed link from another
provider, `http://` — is **not** fetched. Always upload to the project's own
Firebase Storage bucket and send the `getDownloadURL()` result verbatim.

**Attachment failure degrades; it does not error.** If the fetch is refused, times
out, or the file is unreadable, the stream still opens and the model answers
without the document:

- a failed **PDF** is skipped (the estimate still adds ~2,000 tokens for it, so the
  turn is billed as though a document were present);
- a failed **DOCX** part is replaced with the literal text
  `[Failed to read document: <filename>]`, which the model will see and may
  reference.

So there is **no status code to catch** — the only symptom is an answer that
ignores the attachment. Verify the upload succeeded and the URL is a Storage URL
*before* sending, and consider showing the user the resolved filename so a silent
drop is noticeable.

## Fallback: hand-rolled SSE parser

If you prefer not to depend on `@ai-sdk/react`, read the `expo/fetch` body stream
directly and parse `data:` frames:

```ts
const res = await expoFetch(`${BASE_URL}/chat`, {
  method: "POST",
  headers: {
    /* auth + appcheck + x-chat-id + content-type */
  },
  body: JSON.stringify({ messages }),
});
if (!res.ok) throw new Error((await res.json()).error);

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = "";
let answer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6);
    if (payload === "[DONE]") return answer;
    const evt = JSON.parse(payload);
    if (evt.type === "text-delta") {
      answer += evt.delta;
      onToken(answer);
    }
    // evt.type === "reasoning-delta" → optional "thinking" UI
  }
}
```

## Best practices

- **Always send a real `x-chat-id`.** Create the session before the first turn.
  Omitting it is a hard `400 Missing x-chat-id header.` — no stream, nothing billed,
  nothing saved. `useChat` has no `disabled` option, so gate the composer yourself.
- **Fresh token per send.** Compute headers in the transport's `headers` callback
  (async), not once at hook creation — tokens expire mid-conversation.
- **Trim history client-side to ~6.** The server ignores anything older; sending
  less saves upload bandwidth on mobile networks.
- **Keep the screen awake during long generations** only if needed; streams finish
  within the 50s `maxDuration`.
- **Debounce the send button**; disable it while `status === "streaming"`.
- **Upload attachments before sending**, and show upload progress separately from
  the AI response.

## Performance notes

- `expo/fetch` yields chunks as they arrive; append to state with a functional
  update and render Markdown incrementally. Avoid re-parsing the whole Markdown
  string on every token for very long answers — memoize by paragraph if it janks.
- Reasoning deltas can be voluminous; render them in a collapsed block so layout
  doesn't thrash while thinking streams.

## Gotchas

- **Global `fetch` will not stream** the response body in RN — it resolves only
  after the stream closes, defeating the point. Use `expo/fetch`. `react-native-sse`
  is a fallback but must be the variant that supports a POST body + custom headers.
- Errors here are `{ error: string }`, **not** the `{ error: { code, message } }`
  envelope — don't run them through `apiFetch`'s parser.
- **An empty `messages` array is `400 No messages provided.`** — checked *before*
  `x-chat-id`, so a missing header won't be the error you see.
- **Attachment URLs must be on `firebasestorage.googleapis.com` /
  `storage.googleapis.com` over HTTPS, ≤10 MB, and fetchable within 15 s.** Violating
  any of these drops the attachment **silently** — the stream still succeeds and the
  answer just ignores the file. There's no error to catch, so validate client-side.
- A 402 arrives as an error response _before_ any stream frame; handle it in
  `onError`/the initial `!res.ok` check, not mid-stream.
- **`useChat` has no `disabled` option.** Passing `disabled: !chatId` compiles but
  does nothing — the send still fires and the server answers `400`. Guard the
  composer / `sendMessage` call site instead.
- The reasoning stream is on by default; if your UI has no place for it, drop
  `reasoning` parts rather than rendering them inline with the answer.
