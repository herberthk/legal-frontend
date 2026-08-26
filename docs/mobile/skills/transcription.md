# Transcription — Mobile Agent Skill

> Turn a document or image into clean text. Unlike **Document Review** (structured
> legal analysis), transcription returns **plain transcribed text** — either
> lightly cleaned (`professional`) or verbatim (`original`). Two steps: transcribe
> (metered), then optionally save to history.

## What this covers

- `POST /transcriptions` — metered transcribe of a base64 document → `{ text }`.
- `POST /transcriptions/records` — persist an (edited) transcript to history.
- `GET /transcriptions` (cursor list), `GET /transcriptions/:id`, `DELETE …/:id`.
- Reading a picked file as base64 in RN, the **4-value `mimeType` enum**, and the
  ~10 MB payload cap.

## Transcribe (metered)

Enveloped route (`{ data }` / `{ error }`), so it goes through `apiFetch`.

```
POST /transcriptions
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
{
  "base64Data": "<base64 of the file bytes>",  // 1 – 13,981,014 chars (≈10 MB source)
  "mimeType": "application/pdf",               // EXACTLY one of the 4 values below
  "formatMode": "professional" | "original",   // cleaned vs verbatim
  "fileName": "notes.pdf"                      // 1 – 300 chars
}
→ 200 { "data": { "success": true, "text": "…transcribed text…", "totalTokens": 1234 } }
```

**`mimeType` is a closed enum — exactly these four strings:**

```
application/pdf   image/png   image/jpeg   image/webp
```

Anything else (including `image/jpg`, `image/heic`, `image/gif`, `application/octet-stream`,
or a DOCX mime type) fails Zod validation and returns
`400 { "error": { "code": "BAD_REQUEST", "message": "Invalid request body" } }`.
iOS pickers commonly hand back `image/heic` and Android sometimes `image/jpg`, so
**never forward `asset.mimeType` unmapped** — map or reject it client-side first.
DOCX is not supported here at all; send those to `/review` instead.

**Size cap:** `base64Data` is capped at `ceil(MAX_REVIEW_FILE_SIZE × 4 / 3)` =
**13,981,014 characters**, i.e. a source file of ~10 MB. Over that is the same
generic `400 Invalid request body` — check the byte size **before** encoding so you
can show a real "file too large" message instead of a bare 400.

Errors: **402** (`PAYMENT_REQUIRED`) when out of credit; **400** bad body; **500**
transcription failure. `maxDuration` is **120 s** — allow a long client timeout.

```ts
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { MAX_REVIEW_FILE_SIZE } from "@/constants"; // 10 * 1024 * 1024

// The route's enum — nothing else is accepted.
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
type AcceptedMime = (typeof ACCEPTED)[number];

// Normalise the picker's mime type into the enum, or null if unsupported.
function toAcceptedMime(mime: string | undefined, name: string): AcceptedMime | null {
  const m = (mime ?? "").toLowerCase();
  if ((ACCEPTED as readonly string[]).includes(m)) return m as AcceptedMime;
  if (m === "image/jpg") return "image/jpeg"; // some Android pickers
  // Fall back to the extension when the picker gives nothing useful.
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return null; // heic, gif, docx, … → not transcribable
}

export async function transcribe(formatMode: "professional" | "original") {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];

  const mimeType = toAcceptedMime(asset.mimeType, asset.name);
  if (!mimeType) {
    throw new Error("Only PDF, PNG, JPEG and WebP files can be transcribed.");
  }

  // Check the real size before encoding — a 400 from the server won't tell you why.
  // If size is unknown, reject or obtain actual size from asset.uri file info.
  if (asset.size == null) {
    const fileInfo = await FileSystem.getInfoAsync(asset.uri);
    if (!fileInfo.exists || fileInfo.size == null || fileInfo.size > MAX_REVIEW_FILE_SIZE) {
      throw new Error("File is too large (max 10 MB) or inaccessible.");
    }
  } else if (asset.size > MAX_REVIEW_FILE_SIZE) {
    throw new Error("File is too large (max 10 MB).");
  }

  const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // apiFetch unwraps { data }. The inner { success, text } is the operation result.
  const result = await apiFetch<{ success: boolean; text: string; totalTokens: number }>(
    "/transcriptions",
    {
      method: "POST",
      body: JSON.stringify({
        base64Data,
        mimeType,
        formatMode,
        fileName: asset.name.slice(0, 300),
      }),
    },
  );
  if (!result.success) throw new Error("Transcription failed.");
  return result; // { text, totalTokens }
}
```

`apiFetch` maps a 402 to an `ApiError(code: "PAYMENT_REQUIRED")` — funnel it to
top-up.

## Save to history (optional, separate)

Mirrors the web: upload the source file to Firebase Storage first (for `fileUrl`),
then persist the (possibly user-edited) text. Pass `id` to update an existing
record, omit it to create.

```
POST /transcriptions/records
{
  "id": "…",                      // optional, ≤128 chars — update if present, else create
  "title": "Meeting notes",       // 1 – 300 chars
  "fileName": "notes.pdf",        // 1 – 300 chars
  "fileUrl": "https://…",         // optional; any HTTPS URL, ≤2048 chars
  "transcribedText": "…",         // 1 – 900,000 chars — the final, possibly-edited text
  "formatMode": "professional",   // "professional" | "original"
  "tokensUsed": 1234              // optional, non-negative integer
}
→ 200 { "data": { "success": true, "id": "…" } }
→ 400 { "error": { "code": "BAD_REQUEST", "message": "Invalid request body" } }
→ 404 { "error": { "code": "NOT_FOUND", "message": "…" } }   # `id` unknown or not yours
```

- **Passing an `id` that isn't yours (or doesn't exist) is a `404`, not a silent
  create.** The update path is owner-guarded like every other record route, so a
  stale id from a previous account won't quietly fork a new record — handle the 404
  by dropping the id and retrying as a create.
- **`transcribedText` is capped at 900,000 characters** and `title`/`fileName` at
  300. A long multi-hundred-page transcript can realistically hit that ceiling;
  check the length before saving, because the failure is the same opaque
  `400 Invalid request body`.
- `fileUrl` here is **optional and not host-restricted** — any HTTPS URL is
  accepted. This is deliberately looser than `POST /reviews`, which *requires* a
  Firebase Storage URL (see `document-review.md`). Don't copy one route's
  assumptions to the other.

```ts
const { id } = await apiFetch<{ id: string }>("/transcriptions/records", {
  method: "POST",
  body: JSON.stringify({ title, fileName, fileUrl, transcribedText, formatMode, tokensUsed }),
});
```

## List / read / delete history

```
GET /transcriptions?limit=10&beforeId=<lastId>&q=<search>&timeRange=24h|7d|30d|all
→ 200 { "data": { "success": true, "transcriptions": TranscriptionRecord[], "hasMore": true } }

GET    /transcriptions/:id     → { "data": { "success": true, "record": TranscriptionRecord } }
DELETE /transcriptions/:id     → { "data": { "success": true, "fileUrl": "https://…" } }
```

- **Cursor pagination:** pass the last item's `id` as `beforeId` for the next page;
  stop when `hasMore` is `false`. `limit` ≤ 50 (default 10).
- `q` filters by text; `timeRange` windows by recency.
- On delete, the returned `fileUrl` (if any) is the Storage object you may also
  want to delete client-side — the server only removes the Firestore record.

```ts
type FormatMode = "professional" | "original";
interface TranscriptionRecord {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  transcribedText: string;
  formatMode: FormatMode;
  tokensUsed?: number;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```

## Transcription vs. Review — which to call

| | Transcription | Review (`document-review.md`) |
|---|---|---|
| Output | plain text (`professional`/`original`) | structured legal analysis (score, clauses, risks) |
| Upload | base64 JSON | multipart file |
| Enveloped | yes (`apiFetch`) | no (`{ success, review }`) |
| Use for | "read this document to me / give me the text" | "is this contract fair / what are the risks" |

## Best practices

- **Validate the mime type and size before encoding.** Both violations come back as
  the same opaque `400 Invalid request body`, so the client has to be the one that
  produces a useful message.
- **Mind the payload size.** Base64 inflates bytes ~33%, and it rides inside a JSON
  body — a 5 MB file becomes a ~6.7 MB request. The hard server cap is
  **13,981,014 base64 chars (~10 MB source)**; stay well under it on mobile networks
  and downscale large images before encoding.
- **Free the base64 string** after the request resolves so it isn't retained in
  memory during a long session.
- **Edit-then-save.** Let the user correct `text` before `POST …/records`; save the
  edited `transcribedText`, not the raw model output.
- **Long timeout** (~120 s) and a progress state; transcription of multi-page PDFs
  is not instant.

## Gotchas

- **`mimeType` is exactly one of `application/pdf`, `image/png`, `image/jpeg`,
  `image/webp`.** `image/jpg`, `image/heic`, `image/gif` and
  `application/octet-stream` are all rejected — never forward a picker's raw
  `asset.mimeType` without mapping it.
- **`base64Data` is capped at 13,981,014 chars (~10 MB source file)** and `fileName`
  at 300 chars. Exceeding either gives the same generic `400 Invalid request body`.
- **On `POST …/records`: `transcribedText` ≤ 900,000 chars, `title` ≤ 300, and an
  `id` you don't own is a `404`** — not a silent create. Drop the id and retry as a
  create if you get one.
- `formatMode` must be exactly `"professional"` or `"original"`.
- **DOCX is not transcribable.** There's no DOCX branch on this route (unlike `/chat`
  and `/review`, which extract it with `mammoth`) — route those files to `/review`.
- The transcribe call **does not persist** anything — without the `records` call the
  text is lost when the screen unmounts.
- `DELETE` removes only the Firestore record; delete the Storage file yourself with
  the returned `fileUrl` if you want the bytes gone too.
- Reading a file as base64 with `expo-file-system` loads it fully into memory — not
  suitable for very large files; those belong in Review (multipart streams).
