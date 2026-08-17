# Support & Help — Mobile Agent Skill

> Let the user open support tickets, hold a threaded conversation with the support
> team, and browse help articles (FAQs). All enveloped (`{ data }`) through
> `apiFetch`. Identity fields (who you are, what role you post as) are **always taken
> from the verified token** — the client supplies only content.

## What this covers

- `GET /support/tickets` — the caller's tickets.
- `POST /support/tickets` — open a ticket.
- `GET /support/tickets/:id/messages` — read a ticket thread.
- `POST /support/tickets/:id/messages` — reply on a ticket.
- `GET /support/help-articles` — FAQ content, optionally by category.

## Tickets

```
GET /support/tickets
→ 200 { "data": Complaint[] }          # the caller's tickets, newest first

POST /support/tickets
{
  "category":    "REFUND" | "OVERCHARGE" | "DOUBLE_CHARGE" | "TECHNICAL" | "OTHER",
  "subject":     "…",                  // 1–200 chars
  "description": "…",                  // 1–5000 chars
  "priority":    "LOW" | "MEDIUM" | "HIGH",
  "transactionId": "…"                 // optional, ≤ 200 chars — link a disputed charge
}
→ 200 { "data": { "success": true, "ticketId": "…" } }
→ 200 { "data": { "success": false, "error": "Failed to create ticket" } }
```

- **`GET /support/tickets` returns a bare array inside `data`** (not `{ success,
  tickets }`) — `apiFetch<Complaint[]>("/support/tickets")` gives you the array.
- On create, `userId`, `userName`, and `email` are stamped from the **verified user
  document** — you send only the complaint fields. Don't put identity in the body;
  it's ignored.
- New tickets open with `status: "OPEN"`.

```ts
type ComplaintCategory = "REFUND" | "OVERCHARGE" | "DOUBLE_CHARGE" | "TECHNICAL" | "OTHER";
type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
interface Complaint {
  id: string;
  userId: string;
  userName: string;
  email: string;
  transactionId?: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
  resolutionNote?: string;
}

// List
const tickets = await apiFetch<Complaint[]>("/support/tickets");

// Create
const { success, ticketId } = await apiFetch<{ success: boolean; ticketId?: string }>(
  "/support/tickets",
  {
    method: "POST",
    body: JSON.stringify({ category, subject, description, priority, transactionId }),
  },
);
```

For a billing dispute, prefill `transactionId` from the wallet/usage screens (see
`billing-and-usage.md`) so support can find the charge instantly.

## Ticket thread (messages)

```
GET /support/tickets/:id/messages
→ 200 { "data": TicketMessage[] }        # oldest → newest
→ 404 NOT_FOUND                          # ticket unknown OR not yours

POST /support/tickets/:id/messages
{
  "text": "…",                           // 1–5000 chars
  "attachments": ["https://…", …]        // optional, ≤ 10 URLs (Storage download URLs)
}
→ 200 { "data": { "success": true, "messageId": "…" } }
→ 404 NOT_FOUND                          # ticket unknown OR not yours
```

- Both endpoints **verify the ticket belongs to the caller** and return **404** on a
  foreign/unknown id (never 403). Only open threads you own.
- `GET …/messages` returns a **bare array** inside `data`, oldest-first — render it as
  a chat and reverse/anchor as needed.
- **`senderId` and `senderRole` are forced from the verified user** — you cannot post
  as someone else or as an admin. This is a deliberate **privilege-escalation guard**:
  an `ADMIN`/`SUPER_ADMIN` reply triggers a customer-notification email, so a customer
  message always records the real (`USER`) role. Don't send a role in the body.
- **Attachments are HTTPS URLs**, not raw files. Upload to Firebase Storage first
  (same pattern as chat/review), then pass the download URLs.

```ts
type Role = "USER" | "ADMIN" | "SUPER_ADMIN";
interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: Role;        // "USER" for customer messages; "ADMIN"/"SUPER_ADMIN" for staff
  text: string;
  attachments?: string[];  // download URLs
  createdAt: string;       // ISO
}

const thread = await apiFetch<TicketMessage[]>(`/support/tickets/${id}/messages`);

await apiFetch(`/support/tickets/${id}/messages`, {
  method: "POST",
  body: JSON.stringify({ text, attachments }),   // attachments optional
});
```

Align bubbles by `senderRole`: `USER` = the customer (right), `ADMIN`/`SUPER_ADMIN` =
support (left).

## Help articles (FAQ)

```
GET /support/help-articles?category=Billing     # category optional
→ 200 { "data": HelpArticle[] }                  # ordered by `order` asc
```

```ts
interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string;   // Markdown
  order: number;
  createdAt: string; // ISO
}

const all = await apiFetch<HelpArticle[]>("/support/help-articles");
const billing = await apiFetch<HelpArticle[]>("/support/help-articles?category=Billing");
```

- Returns a **bare array** inside `data`, sorted by `order`.
- `content` is **Markdown** — render with the same Markdown component you use for chat.
- The server seeds a couple of default articles if none exist, so the list is never
  empty; group the results by `category` for a sectioned FAQ screen.

## Best practices

- **Poll the thread** on the ticket screen (e.g. on focus / pull-to-refresh, or a
  light interval while open) — there's no push for support replies over this API. A
  new admin reply also arrives as an **email** (server-side) and may create an inbox
  notification (see `push-notifications.md`).
- **Prefill `transactionId`** for `REFUND`/`OVERCHARGE`/`DOUBLE_CHARGE` categories
  from the transaction the user tapped, so support has the reference immediately.
- **Upload attachments before posting** and show upload progress separately from the
  send action; cap at 10 URLs to match the server.
- **Render help `content` as Markdown**, and cache the article list — it changes
  rarely.
- **Treat 404 as "gone or not yours"** on ticket threads; drop it from the local list
  rather than showing "forbidden".

## Performance notes

- Help articles are effectively static — fetch once, cache in memory/MMKV, and
  refresh occasionally rather than on every visit.
- Ticket threads are small; a full refetch on focus is fine. If you poll, use a modest
  interval (e.g. 15–30 s) and stop when the screen blurs.

## Gotchas

- Several of these routes return a **bare array** inside `data`
  (`/support/tickets`, `…/messages`, `/help-articles`) — not a `{ success, … }`
  object. `apiFetch<T[]>` unwraps straight to the array.
- **`POST` routes here need a full user** (`requireMobileUser`), so a missing/expired
  token 401s before validation. Ensure a fresh ID token.
- **Never send `senderId`/`senderRole`/`userId`/`email`/`userName`** — they're derived
  server-side from the token; supplying them does nothing (and posting as `ADMIN` is
  impossible by design).
- **Attachments are URLs, not files** — upload to Storage first; a raw `file://` URI
  will fail URL validation (`≤ 2048` chars, must be a valid URL).
- Ticket message threads are **oldest-first**; reverse for a bottom-anchored chat view.
