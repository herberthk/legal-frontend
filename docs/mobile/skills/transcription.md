# Transcription — Mobile Agent Skill

> Turn a document or image into clean text. Unlike **Document Review** (structured
> legal analysis), transcription returns **plain transcribed text** — either
> lightly cleaned (`professional`) or verbatim (`original`). Two steps: transcribe
> (metered), then optionally save to history.

## What this covers

- `POST /transcriptions` — metered transcribe of a base64 document → `{ text }`.
- `POST /transcriptions/records` — persist an (edited) transcript to history.
- `GET /transcriptions` (cursor list), `GET /transcriptions/:id`, `DELETE …/:id`.
- Reading a picked file as base64 in RN, and payload-size caveats.

## Transcribe (metered)

Enveloped route (`{ data }` / `{ error }`), so it goes through `apiFetch`.

```
POST /transcriptions
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: application/json
{
  "base64Data": "<base64 of the file bytes>",
  "mimeType": "application/pdf",              // or image/png, image/jpeg, …
  "formatMode": "professional" | "original",  // cleaned vs verbatim
  "fileName": "notes.pdf"
}
→ 200 { "data": { "success": true, "text": "…transcribed text…", "totalTokens": 1234 } }
```

Errors: **402** (`PAYMENT_REQUIRED`) when out of credit; **400** bad body; **500**
transcription failure. `maxDuration` is **120 s** — allow a long client timeout.

```ts
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

export async function transcribe(formatMode: "professional" | "original") {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];

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
        mimeType: asset.mimeType ?? "application/octet-stream",
        formatMode,
        fileName: asset.name,
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
  "id": "…",                      // optional — update if present, else create
  "title": "Meeting notes",
  "fileName": "notes.pdf",
  "fileUrl": "https://…",         // optional; Storage download URL
  "transcribedText": "…",         // the final, possibly-edited text
  "formatMode": "professional",
  "tokensUsed": 1234              // optional
}
→ 200 { "data": { "success": true, "id": "…" } }
```

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

- **Mind the payload size.** Base64 inflates bytes ~33%, and it rides inside a JSON
  body — a 5 MB file becomes a ~6.7 MB request. Prefer smaller files/images on
  mobile networks; for large PDFs, warn or downscale. (There is no separate size
  field here, but the transcribe call is metered and slow for big inputs.)
- **Free the base64 string** after the request resolves so it isn't retained in
  memory during a long session.
- **Edit-then-save.** Let the user correct `text` before `POST …/records`; save the
  edited `transcribedText`, not the raw model output.
- **Long timeout** (~120 s) and a progress state; transcription of multi-page PDFs
  is not instant.

## Gotchas

- `formatMode` must be exactly `"professional"` or `"original"`.
- The transcribe call **does not persist** anything — without the `records` call the
  text is lost when the screen unmounts.
- `DELETE` removes only the Firestore record; delete the Storage file yourself with
  the returned `fileUrl` if you want the bytes gone too.
- Reading a file as base64 with `expo-file-system` loads it fully into memory — not
  suitable for very large files; those belong in Review (multipart streams).
