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

```jsonc
// 200 GET /me response payload:
{
  "data": {
    "id": "usr_9f8e7d6c5b4a",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "avatar": "https://lh3.googleusercontent.com/a/...",
    "role": "USER",
    "balance": 1500,              // US CENTS ($15.00) — convert to UGX for display (× 3800)
    "totalSpent": 350,            // US CENTS ($3.50)
    "status": "active",           // "active" | "suspended" | "banned"
    "preferedVoice": {
      "preferedVoiceId": "Zephyr",
      "preferedVoiceName": "Zephyr (Female)"
    },
    "welcomeTextTokens": 4000,    // One-time welcome bonus tokens
    "freeTextTokens": 1000,       // Daily recurring free tokens
    "freeVoiceSeconds": 300,      // One-time welcome bonus (300s = 5 mins)
    "nextDailyReset": "2026-10-22T00:00:00.000Z",
    "createdAt": "2026-03-15T10:30:00.000Z",
    "updatedAt": "2026-10-21T08:15:00.000Z",
    "username": "janedoe",
    "phoneNumber": "+256770000000"
  }
}
```

`GET /me` is the canonical **balance + identity** call — poll/refetch it after any
spend (chat, review, voice) or top-up to refresh the wallet.

```ts
type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

interface PreferedVoice {
  preferedVoiceId: VoiceId;
  preferedVoiceName: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  balance: number;            // in US CENTS (e.g. 1500 = $15.00)
  totalSpent: number;         // in US CENTS
  status: "active" | "suspended" | "banned";
  preferedVoice?: PreferedVoice;
  welcomeTextTokens: number;
  freeTextTokens: number;
  freeVoiceSeconds: number;
  nextDailyReset: string;     // ISO timestamp
  createdAt: string;          // ISO timestamp
  updatedAt?: string;         // ISO timestamp
  username?: string;
  phoneNumber?: string;
}
```

> **Balances are in US cents.** The UI converts to UGX (see `billing-and-usage.md`
> for the exchange constant). Never render the raw cents value as a currency.

```
PATCH /me
{ "name"?: string, "avatar"?: string }   # at least one; avatar must be a URL
→ 200 { "data": { "success": true, "message": "Profile updated successfully" } }
```

```
PATCH /me/voice-preference
{ "preferedVoiceId": "Zephyr", "preferedVoiceName": "Zephyr (Female)" }
→ 200 { "data": { "success": true, "message": "Changed Voice preference to Zephyr (Female)" } }
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
     → 200 { "data": { "success": true, "sessions": ChatSession[] } }

POST /chats  { "title": "New chat" }           # 1–200 chars
     → 200 { "data": { "success": true, "sessionId": "chat_session_abc123" } }

GET  /chats/:id/messages?limit=10&cursorId=&cursorCreatedAt=
     → 200 { "data": { "success": true, "messages": ChatMessageRecord[], "hasMore": true } }

PATCH  /chats/:id  { "title": "New Title" }    # rename; 404 if not owned
       → 200 { "data": { "success": true } }

DELETE /chats/:id                              # deletes messages + attachments; 404 if not owned
       → 200 { "data": { "success": true } }
```

Sample JSON responses:

```jsonc
// 200 GET /chats
{
  "data": {
    "success": true,
    "sessions": [
      {
        "id": "session_123",
        "userId": "usr_abc",
        "title": "Land tenure dispute consultation",
        "messageCount": 8,
        "createdAt": "2026-10-18T14:20:00.000Z",
        "updatedAt": "2026-10-21T09:12:00.000Z"
      }
    ]
  }
}

// 200 GET /chats/:id/messages
{
  "data": {
    "success": true,
    "hasMore": false,
    "messages": [
      {
        "id": "msg_001",
        "sessionId": "session_123",
        "role": "user",
        "text": "What are the tenant rights under the Land Act in Uganda?",
        "tokenCount": 35,
        "createdAt": "2026-10-18T14:20:00.000Z"
      },
      {
        "id": "msg_002",
        "sessionId": "session_123",
        "role": "assistant",
        "text": "Under the Land Act (Cap 227) of Uganda...",
        "tokenCount": 340,
        "createdAt": "2026-10-18T14:20:04.000Z"
      }
    ]
  }
}
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
  id: string;
  userId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageRecord {
  id: string;
  sessionId?: string;
  role: "user" | "assistant";
  text: string;
  tokenCount: number;
  attachment?: { name: string; contentType: string; url: string };
  isFirstMessage?: boolean;
  createdAt: string;
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
    → 200 { "data": { "success": true, "sessions": VoiceSession[], "totalCount": 15, "totalPages": 2 } }

GET /voice/sessions/:id
    → 200 { "data": VoiceSession }
    → 404 NOT_FOUND
```

Sample JSON responses:

```jsonc
// 200 GET /voice/sessions
{
  "data": {
    "success": true,
    "totalCount": 1,
    "totalPages": 1,
    "sessions": [
      {
        "id": "vsession_789",
        "sessionId": "live_session_xyz456",
        "userId": "usr_abc",
        "title": "Discussion on Employment Contract Termination",
        "summary": "User inquired about notice periods required for contract termination under Employment Act 2006.",
        "duration": 185,            // duration in seconds
        "cost": 25,                 // cost in US cents ($0.25)
        "audioUrl": "",
        "transcripts": [
          { "role": "user", "content": "What is the mandatory notice period?" },
          { "role": "AI", "content": "Under Section 58 of the Employment Act 2006, notice depends on service duration..." }
        ],
        "createdAt": "2026-10-20T11:00:00.000Z"
      }
    ]
  }
}
```

```ts
interface Transcript {
  role: "user" | "AI";
  content: string;
}

interface VoiceSession {
  id: string;
  sessionId: string;
  userId: string;
  title: string;
  summary: string;
  duration: number;        // in seconds
  cost: number;            // in US CENTS
  audioUrl?: string;
  transcripts: Transcript[];
  createdAt: string;       // ISO string
}
```

`filter` is a `UsageFilter`; omit for the default (`last_week`). `q` searches titles/transcripts.

## Document review history — `/reviews`

**Cursor-based** via `beforeId`:

```
GET    /reviews?limit=9&beforeId=<lastId>
       → 200 { "data": { "success": true, "reviews": DocumentReview[], "hasMore": true } }

GET    /reviews/:id
       → 200 { "data": { "success": true, "review": DocumentReview } }
       → 404 NOT_FOUND

POST   /reviews
       → 200 { "data": { "success": true, "id": "doc_rev_001" } }

DELETE /reviews/:id
       → 200 { "data": { "success": true, "fileUrl": "https://storage.googleapis.com/..." } }
       → 404 NOT_FOUND
```

Sample JSON responses:

```jsonc
// 200 GET /reviews/:id
{
  "data": {
    "success": true,
    "review": {
      "id": "review_456",
      "userId": "usr_abc",
      "fileName": "Commercial_Lease_2026.pdf",
      "fileUrl": "https://firebasestorage.googleapis.com/v0/b/.../Commercial_Lease_2026.pdf?...",
      "documentType": "Commercial Lease Agreement",
      "summary": "Standard commercial premises lease with onerous indemnification clauses.",
      "overallScore": 68,
      "highlights": [
        "Rent escalation set at 10% annually",
        "Tenant liable for structural repairs"
      ],
      "scoreBreakdown": [
        { "category": "Fairness", "score": 60, "reason": "Repair obligations heavily favor landlord.", "recommendation": "Negotiate landlord obligation for latent structural defects." }
      ],
      "keyClauses": [
        { "title": "Maintenance & Repair", "content": "Tenant shall at all times maintain roof and structure...", "assessment": "High risk transfer of capital expenses.", "riskLevel": "HIGH" }
      ],
      "risks": [
        { "title": "Structural Repair Liability", "description": "Tenant is required to repair external structures.", "severity": "HIGH", "clause": "Clause 8.1", "recommendation": "Limit tenant obligations to interior non-structural maintenance." }
      ],
      "recommendations": [
        { "title": "Cap annual rent increase", "description": "Benchmark rent increase to official inflation rate.", "priority": "MEDIUM" }
      ],
      "tokensUsed": 3200,
      "pageCount": 4,
      "createdAt": "2026-10-19T16:45:00.000Z",
      "updatedAt": "2026-10-19T16:45:00.000Z"
    }
  }
}
```

```ts
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

interface ReviewScoreCategory {
  category: string;
  score: number;           // 0-100
  reason?: string;
  recommendation?: string;
}

interface ReviewClause {
  title: string;
  content: string;
  assessment: string;
  riskLevel: RiskLevel;
}

interface ReviewRisk {
  title: string;
  description: string;
  severity: RiskLevel;
  clause?: string;
  recommendation: string;
}

interface ReviewRecommendation {
  title: string;
  description: string;
  priority: RiskLevel;
}

interface DocumentReview {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  documentType: string;
  summary: string;
  overallScore: number;    // 0-100
  highlights: string[];
  keyClauses: ReviewClause[];
  risks: ReviewRisk[];
  recommendations: ReviewRecommendation[];
  scoreBreakdown: ReviewScoreCategory[];
  tokensUsed: number;
  pageCount: number;
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

On delete, delete the Storage object at the returned `fileUrl` yourself if you want the bytes gone.

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
