# Chat Streaming — Mobile Agent Skill

> Real-time legal chat over Server-Sent Events. The single hard part on RN is that
> the default `fetch` can't stream a POST body's response — you must use
> **`expo/fetch`**. Everything else (the AI SDK client, message shapes) ports
> directly from web.

## What this covers

- The `POST /chat` SSE contract (`x-vercel-ai-ui-message-stream: v1`).
- Consuming it in RN with **`expo/fetch`** + `@ai-sdk/react`'s `useChat`.
- The **`x-chat-id` billing gotcha** — no chat id means no billing _and_ no persistence.
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
// 402 out of credit, 401 auth/appcheck, 500 generation error
{
  "error": "Insufficient tokens. This message requires ~1,200 tokens but you only have ~300…",
}
```

Map **402 → the top-up flow** (`payments-*` skills). The server estimates cost
_before_ streaming and rejects up front, so a 402 arrives instead of a stream.

## Model & server behavior (for context)

- Model `gemini-3.6-flash`, `temperature: 0`, thinking/reasoning enabled
  (`sendReasoning: true` → you receive `reasoning-delta` parts).
- Server keeps only the **last 6 messages** (`MAX_HISTORY_MESSAGES`) — you may send
  full history, but sending the last ~6 saves bandwidth and matches server context.
- The output is smoothed word-by-word server-side, so you get an even cadence — no
  client-side smoothing needed.
- Attachments: **PDF and images stream natively**; **DOCX is extracted to text
  server-side** (via `mammoth`). You never parse documents on the device.

## ⚠️ The `x-chat-id` billing gotcha

The server **only bills and persists a turn when a non-empty `x-chat-id` is
present.** Without it, the response still streams (and still costs the backend
money at the provider) but **nothing is deducted and nothing is saved.** That is a
correctness trap, not a free tier.

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
        const h: Record<string, string> = {
          Authorization: `Bearer ${idToken}`,
          "x-first-message": isFirst.current ? "true" : "false",
        };
        // Only attach x-chat-id once we have a real session ID.
        // Sending an empty value would create a server-side session conflict.
        if (chatId) h["x-chat-id"] = chatId;
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
    // Prevent sending while chatId is empty — useChat will re-enable once
    // the prop updates to a non-empty value.
    disabled: !chatId,
    onFinish: () => {
      // Mark first turn completed ONLY when a message response finishes successfully.
      // Failed turns will retain x-first-message: "true" on retry so title generation works.
      isFirst.current = false;
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
  Skipping it means unbilled, unsaved messages — a silent data-loss bug.
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
- A 402 arrives as an error response _before_ any stream frame; handle it in
  `onError`/the initial `!res.ok` check, not mid-stream.
- The reasoning stream is on by default; if your UI has no place for it, drop
  `reasoning` parts rather than rendering them inline with the answer.
