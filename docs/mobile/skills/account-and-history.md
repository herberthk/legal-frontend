# Account & History — Mobile Agent Skill

> The read/manage surface: the signed-in user's profile ("who am I" + balance),
> voice preference, and the history lists for chats, voice sessions, and document
> reviews. All enveloped (`{ data }`), all through `apiFetch`.

## What this covers

- `GET /me` (profile + balance), `PATCH /me`, `PATCH /me/voice-preference`.
- Chat session history: list, create, messages (cursor), rename, delete.
- Voice session history (page-based) and a single session.
- Document review history (cursor) and delete.
- The three different pagination styles and when each applies.

## Profile — `/me`

```
GET /me
→ 200 { "data": User }        # full user doc, dates normalized to ISO
→ 404 NOT_FOUND               # no profile yet → call POST /auth/profile/sync
```

`GET /me` is the canonical **balance + identity** call — poll/refetch it after any
spend (chat, review, voice) or top-up to refresh the wallet. The `User` shape
(ambient `types/index.d.ts`) includes `id, name, email, avatar, role, balance`
(**US cents**), `totalSpent, status, preferedVoice?, welcomeTextTokens,
freeTextTokens, freeVoiceSeconds, nextDailyReset, createdAt, updatedAt?`.

> **Balances are in US cents.** The UI converts to UGX (see `billing-and-usage.md`
> for the exchange constant). Never render the raw cents value as a currency.

```
PATCH /me
{ "name"?: string, "avatar"?: string }   # at least one; avatar must be a URL
→ 200 { "data": { "success": true, … } }
```

```
PATCH /me/voice-preference
{ "preferedVoiceId": "Zephyr", "preferedVoiceName": "Zephyr (Female)" }
→ 200 { "data": { "success": true, … } }
```

`preferedVoiceId` feeds the Gemini Live `voiceName` (see `voice-chat.md`). It is a
**closed 17-value enum** — anything else is `400 Invalid request body`:

```
Puck  Charon  Kore  Fenrir  Aoede  Zephyr  Terra  Lyra  Orion
Ursa  Nova  Pegasus  Hydra  Leda  Orus  Achernar  Umbriel
```

Mirror this list in the client (it is exported as `VOICES` server-side) and build
the voice picker from it rather than a free-text field. **Both fields are
required** — `preferedVoiceName` is a free display label (1–120 chars) and is *not*
checked against the enum, but omitting it is still `400 Invalid request body`.

```ts
const me = await apiFetch<User>("/me");
await apiFetch("/me", { method: "PATCH", body: JSON.stringify({ name }) });
await apiFetch("/me/voice-preference", {
  method: "PATCH",
  body: JSON.stringify({ preferedVoiceId, preferedVoiceName }),
});
```

## Chat history — `/chats`

```
GET  /chats?limit=20                          # ≤50, most recent first (by updatedAt)
     → { "data": { "success": true, "sessions": ChatSession[] } }

POST /chats  { "title": "New chat" }           # 1–200 chars
     → { "data": { "success": true, "sessionId": "…" } }

GET  /chats/:id/messages?limit=10&cursorId=&cursorCreatedAt=
     → { "data": { "success": true, "messages": ChatMessageRecord[], "hasMore": true } }

PATCH  /chats/:id  { "title": "…" }            # rename; 404 if not owned
DELETE /chats/:id                               # deletes messages + attachments; 404 if not owned
```

- **Create a session before streaming into it.** The `sessionId` is what you send
  as `x-chat-id` on `POST /chat` — without it, messages are neither billed nor
  saved (see `chat-streaming.md`).
- **Messages are returned oldest → newest.** To load an *older* page, pass the
  **oldest** currently-loaded message's `id` and `createdAt` as `cursorId` /
  `cursorCreatedAt`. Stop when `hasMore` is `false`. (This is the classic
  "load earlier messages" scroll-up in a chat UI.)

```ts
interface ChatSession {
  id: string; userId: string; title: string;
  messageCount: number; createdAt: string; updatedAt: string;
}
interface ChatMessageRecord {
  id: string; role: "user" | "assistant"; text: string; tokenCount: number;
  attachment?: { name: string; contentType: string; url: string };
  isFirstMessage?: boolean; createdAt: string;
}

async function loadOlder(chatId: string, oldest?: ChatMessageRecord) {
  const q = new URLSearchParams({ limit: "20" });
  if (oldest) { q.set("cursorId", oldest.id); q.set("cursorCreatedAt", oldest.createdAt); }
  return apiFetch<{ messages: ChatMessageRecord[]; hasMore: boolean }>(
    `/chats/${chatId}/messages?${q}`,
  );
}
```

## Voice session history — `/voice/sessions`

**Page-based** (not cursor):

```
GET /voice/sessions?page=1&limit=10&filter=today|yesterday|last_week|month|custom&q=<search>
    → { "data": <getVoiceSessions result: sessions + paging> }

GET /voice/sessions/:id
    → { "data": <single session with transcripts> }
```

`filter` is a `UsageFilter`; omit for the default. `q` searches titles/transcripts.
Each session carries the transcript array, `duration`, `cost`, `summary`, `title`,
and timestamps that `POST /voice/billing` produced (see `voice-chat.md`).

## Document review history — `/reviews`

**Cursor-based** via `beforeId`:

```
GET    /reviews?limit=9&beforeId=<lastId>
       → { "data": { "success": true, "reviews": DocumentReview[], "hasMore": true } }
GET    /reviews/:id       → { "data": { "success": true, "review": DocumentReview } }
DELETE /reviews/:id       → { "data": { "success": true, "fileUrl"?: "…" } }
POST   /reviews           → save a completed review (see document-review.md)
```

`DocumentReview` = the `review` object from `document-review.md` **plus** `id`,
`userId`, `fileUrl`, `createdAt`, `updatedAt`. On delete, delete the Storage object
at the returned `fileUrl` yourself if you want the bytes gone.

## Transcription history — `/transcriptions`

Covered fully in `transcription.md` (cursor via `beforeId`, plus `q` and
`timeRange`). Same envelope conventions.

## The three pagination styles (don't mix them up)

| Surface | Style | Params | Next page |
|---|---|---|---|
| `/chats` (sessions) | simple limit | `limit` | refetch (no cursor) |
| `/chats/:id/messages` | **timestamp cursor** | `limit`, `cursorId`, `cursorCreatedAt` | oldest loaded message's id+createdAt |
| `/reviews`, `/transcriptions` | **id cursor** | `limit`, `beforeId` (+ `q`, `timeRange`) | last item's `id` |
| `/voice/sessions` | **page number** | `page`, `limit`, `filter`, `q` | `page + 1` |

Stop paging when `hasMore === false` (cursor lists) or a short page returns (voice).

## Best practices

- **Treat `/me` as the wallet.** Refetch after any spend or top-up rather than
  computing balances client-side. `AuthProvider`-style live sync isn't available
  over HTTP; poll `/me` (or re-fetch on screen focus) instead.
- **Cache list pages** in memory and append on paginate; don't refetch page 1 on
  every scroll.
- **Optimistic rename/delete** for chats is fine (they're owner-guarded server-side
  and return 404 on a foreign id), but reconcile on the response.
- **404 means gone or not yours** — never surface it as "forbidden," and drop the
  item from the local list.

## Gotchas

- Balances are **cents**; format via the UGX conversion, never raw.
- `/chats/:id/messages` needs **both** `cursorId` and `cursorCreatedAt` — sending
  one without the other is a hard **`400 Both cursorId and cursorCreatedAt must be
  provided together`**, not a silently-ignored cursor. Send both or neither.
  `cursorCreatedAt` must also parse as a date (`Date.parse`) or it's
  `400 cursorCreatedAt must be a valid date string` — pass the record's ISO
  `createdAt` through unchanged.
- `limit` on `/chats/:id/messages` is **strictly validated**: a non-integer, `<1`, or
  `>50` value is `400 limit must be an integer between 1 and 50`. This differs from
  `GET /chats`, where an invalid `limit` is silently coerced to the default 20 —
  don't assume one route's leniency applies to the other.
- Chat messages come oldest-first; reverse for a bottom-anchored chat view or render
  in a `FlatList` with `inverted` and prepend older pages.
- Renaming/deleting a chat you don't own returns 404 (IDOR guard), not 403.
- Deleting a review/transcription removes only the Firestore record; its Storage
  file must be deleted separately using the returned `fileUrl`.
