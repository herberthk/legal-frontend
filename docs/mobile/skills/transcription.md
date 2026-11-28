# Transcription — Mobile Agent Skill

> Turn a document or image into clean text. Unlike **Document Review** (structured
> legal analysis), transcription returns **plain transcribed text** — either
> lightly cleaned (`professional`) or verbatim (`original`). Two steps: transcribe
> (metered), then optionally save to history.

## What this covers

- `POST /transcriptions` — metered transcribe of a document uploaded to Firebase Storage → `{ text }`.
- `POST /transcriptions/records` — persist an (edited) transcript to history.
- `GET /transcriptions` (cursor list), `GET /transcriptions/:id`, `DELETE …/:id`.
- Uploading a picked file to Firebase Storage temp path, the **4-value `mimeType` enum**, and
  the ~10 MB size cap.

## Architecture note — web vs. mobile

Both surfaces share the **same validation schema** (`transcribePostSchema` from `lib/api/handlers/transcribe.ts`), the same service core (`services/transcribe.ts`), and enforce **Firebase App Check** as the first step:

| Surface | Route | Auth | App Check |
|---|---|---|---|
| **Web** | `POST /api/transcribe` | session cookie | `verifyAppCheckHeader(req)` |
| **Mobile** | `POST /api/v1/transcriptions` | Bearer ID token | `requireMobileAuth` guard |

The web app calls the route via `fetch("/api/transcribe", …)` from the
`useDocumentTranscribe` hook and attaches the reCAPTCHA Enterprise token with
the `x-firebase-appcheck` header — identical to the chat and review routes.
This guarantees App Check is enforced consistently across all AI-metered endpoints.

## Transcribe (metered)

Enveloped route (`{ data }` / `{ error }`), so it goes through `apiFetch`.

The client **must** upload the file directly to Firebase Storage under
`temp/transcriptions/${userId}/${timestamp}_${fileName}` and then submit only
the resulting `storagePath`. This completely bypasses Vercel's 4.5 MB
Serverless Function payload limit — no base64 encoding required.

```
POST /transcriptions
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
{
  "storagePath": "temp/transcriptions/<userId>/1730900000_notes.pdf",
  "mimeType": "application/pdf",           // EXACTLY one of the 4 values below
  "formatMode": "professional" | "original", // cleaned vs verbatim
  "fileName": "notes.pdf"                  // 1 – 300 chars
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

Errors: **402** (`PAYMENT_REQUIRED`) when out of credit; **400** bad body; **500**
transcription failure. `maxDuration` is **120 s** — allow a long client timeout.

```ts
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
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

export async function transcribe(
  userId: string,
  formatMode: "professional" | "original",
) {
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

  // Check the real size before uploading.
  if ((asset.size ?? 0) > MAX_REVIEW_FILE_SIZE) {
    throw new Error("File is too large (max 10 MB).");
  }

  // 1. Upload the file to Firebase Storage under the temp path.
  const timestamp = Date.now();
  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const storagePath = `temp/transcriptions/${userId}/${timestamp}_${safeFileName}`;

  const storage = getStorage();
  const storageRef = ref(storage, storagePath);
  const fileBlob = await (await fetch(asset.uri)).blob();
  await uploadBytesResumable(storageRef, fileBlob, { contentType: mimeType });

  // 2. Submit storagePath — no base64, no size limit on the HTTP body.
  const result = await apiFetch<{ success: boolean; text: string; totalTokens: number }>(
    "/transcriptions",
    {
      method: "POST",
      body: JSON.stringify({
        storagePath,
        mimeType,
        formatMode,
        fileName: asset.name.slice(0, 300),
      }),
    },
  );
  if (!result.success) throw new Error("Transcription failed.");
  return { ...result, tempStoragePath: storagePath }; // { text, totalTokens, tempStoragePath }
}
```

`apiFetch` maps a 402 to an `ApiError(code: "PAYMENT_REQUIRED")` — funnel it to
top-up.

## Save to history (optional, separate)

Mirrors the web: pass the `tempStoragePath` from the transcribe step so the server
promotes it atomically to permanent storage. Pass `id` to update an existing
record, omit it to create.

```
POST /transcriptions/records
{
  "id": "…",                      // optional, ≤128 chars — update if present, else create
  "title": "Meeting notes",       // 1 – 300 chars
  "fileName": "notes.pdf",        // 1 – 300 chars
  "fileUrl": "https://…",         // optional; any HTTPS URL, ≤2048 chars
  "tempStoragePath": "temp/…",    // optional; automatically promotes to permanent storedFiles/
  "transcribedText": "…",         // 1 – 900,000 chars — the final, possibly-edited text
  "formatMode": "professional",   // "professional" | "original"
  "tokensUsed": 1234              // optional, non-negative integer
}
→ 200 { "data": { "success": true, "id": "…" } }
→ 400 { "error": { "code": "BAD_REQUEST", "message": "Invalid request body" } }
→ 404 { "error": { "code": "NOT_FOUND", "message": "…" } }   # `id` unknown or not yours
```

- **Automatic promotion from temporary storage:** Pass the `tempStoragePath` returned from the transcribe step. The server atomically moves the file from `temp/transcriptions/` to permanent `storedFiles/transcriptions/` in Google Cloud Storage, assigns the permanent `fileUrl`, and clears the temporary file with zero additional upload bandwidth.
- **24-Hour Temp Cleanup:** Files left in `temp/transcriptions/` that are not saved to records are automatically purged by a Firebase Cloud Function scheduled scheduler every hour, cleaning files older than 24 hours.

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
  body: JSON.stringify({ title, fileName, tempStoragePath, transcribedText, formatMode, tokensUsed }),
});
```

## List / read / delete history

```
GET /transcriptions?limit=10&beforeId=<cursorId>&q=<search>&timeRange=24h|7d|30d|all
→ 200 { "data": { "success": true, "transcriptions": TranscriptionRecord[], "hasMore": true, "nextCursorId": "…" } }

GET    /transcriptions/:id     → { "data": { "success": true, "record": TranscriptionRecord } }
DELETE /transcriptions/:id     → { "data": { "success": true, "fileUrl": "https://…" } }
```

- **Cursor pagination:** for a nonblank `q`, pass `data.nextCursorId` as
  `beforeId` whenever `data.hasMore` is `true`, even if `transcriptions` is
  empty. A search cursor can point past the last displayed match. Without a
  search, use the last item's `id` when `hasMore` is `true`. Keep `q` and
  `timeRange` the same between pages. Stop when `hasMore` is `false`.
  `limit` ≤ 50 (default 10).
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
| Upload | Firebase Storage (storagePath) | multipart file |
| Enveloped | yes (`apiFetch`) | no (`{ success, review }`) |
| Use for | "read this document to me / give me the text" | "is this contract fair / what are the risks" |

## Best practices

- **Validate the mime type and size before uploading.** Both violations come back as
  the same opaque `400 Invalid request body`, so the client has to be the one that
  produces a useful message.
- **Show upload progress** using `uploadBytesResumable`'s `on('state_changed', …)`
  callback — large files on mobile networks can take several seconds.
- **Pass `tempStoragePath` to the records call** so the temp file is promoted to
  permanent storage without a second upload. If the user discards the result without
  saving, the file is auto-cleaned within 24 hours.
- **Edit-then-save.** Let the user correct `text` before `POST …/records`; save the
  edited `transcribedText`, not the raw model output.
- **Long timeout** (~120 s) and a progress state; transcription of multi-page PDFs
  is not instant.

## Gotchas

- **`mimeType` is exactly one of `application/pdf`, `image/png`, `image/jpeg`,
  `image/webp`.** `image/jpg`, `image/heic`, `image/gif` and
  `application/octet-stream` are all rejected — never forward a picker's raw
  `asset.mimeType` without mapping it.
- **`fileName` is capped at 300 chars.** Exceeding it gives `400 Invalid request body`.
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
