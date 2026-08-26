# Document Review — Mobile Agent Skill

> Upload a legal document (PDF / DOCX / image) and get back a **structured legal
> analysis**: type, summary, an overall 0–100 score, per-category breakdown, key
> clauses, risks, and recommendations. A metered AI call, `multipart/form-data` in,
> structured JSON out.

## What this covers

- The `POST /review` multipart contract and the full `review` response schema.
- Picking a file in RN and uploading it as `FormData` (the `Content-Type` gotcha).
- The non-enveloped success/error shapes and status codes.
- Rendering the structured result.

## Endpoint

```
POST /review
Authorization: Bearer <id-token>
X-Firebase-AppCheck: <app-check-token>
Content-Type: multipart/form-data          # set by FormData — do NOT set it yourself

form field: file   (PDF, DOCX, or ANY image/* — max 10 MB)
```

**Accepted types are broader here than on `/transcriptions`.** The check is
`application/pdf`, the DOCX mime type, or **any** mime type starting with
`image/` — so `image/heic`, `image/gif`, `image/tiff` and friends all pass, unlike
the 4-value enum on `/transcriptions` (see `transcription.md`). Anything else is
`400 Unsupported file type…`.

This route is **not enveloped** (it mirrors the web handler for single-sourcing).

**Success (HTTP 200):**

```jsonc
{
  "success": true,
  "review": {
    "documentType": "Lease Agreement",
    "summary": "…",
    "overallScore": 72,                     // 0–100
    "highlights": ["…", "…"],
    "scoreBreakdown": [
      { "category": "Fairness", "score": 65, "reason": "…", "recommendation": "…" }
    ],
    "keyClauses": [
      { "title": "Termination", "content": "…", "assessment": "…", "riskLevel": "HIGH" }
    ],
    "risks": [
      { "title": "…", "description": "…", "severity": "MEDIUM", "clause": "…", "recommendation": "…" }
    ],
    "recommendations": [
      { "title": "…", "description": "…", "priority": "HIGH" }
    ],
    "fileName": "lease.pdf",
    "tokensUsed": 4120,
    "pageCount": 6
  }
}
```

`riskLevel`, `severity`, `priority` are each one of `LOW` | `MEDIUM` | `HIGH`.
`clause` on a risk is optional.

**Error (flat string, not the envelope):**

| Status | Meaning |
|---|---|
| 400 | no file / >10 MB / unsupported type |
| 402 | out of credit — route to top-up |
| 422 | file unreadable (empty, corrupt, encrypted, or corrupted document structure) |
| 401 | auth / App Check |
| 500 | unexpected |

```jsonc
{ "error": "File size exceeds 10MB limit. Your file is 12.4MB." }
```

## Server behavior (context)

- Text-based **PDF/DOCX** → text is extracted server-side and analyzed as text.
- **Scanned PDFs / images** → supported natively! Sent to Gemini as visual files (multimodal OCR + reasoning). You just upload the file; the server automatically detects scanned documents and routes them through the visual path.
- Cost is estimated up front; insufficient credit returns **402 before** any work —
  the credit check runs *before* the multipart body is even parsed, so a 402 can
  arrive without the file having been uploaded in full.
- `maxDuration` is **120 s** — set a generous client timeout (see below).

## RN implementation

Do **not** use `apiFetch` (that unwraps the `{data}` envelope, which this route
doesn't use). Reuse `authHeaders()` from `error-handling.md`, but let `FormData`
set the `Content-Type`.

```ts
import * as DocumentPicker from "expo-document-picker";
import { fetch as expoFetch } from "expo/fetch"; // or global fetch — response is small JSON

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export async function reviewDocument(): Promise<Review> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/*",
    ],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) throw new Error("cancelled");
  const asset = picked.assets[0];

  if (asset.size && asset.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds the 10 MB limit.");
  }

  const form = new FormData();
  form.append("file", {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "application/octet-stream",
  } as any); // RN's FormData file shape

  const headers = await authHeaders();          // Authorization + X-Firebase-AppCheck ONLY
  // IMPORTANT: do not set Content-Type — FormData adds the multipart boundary.

  // Abort after 130 s — intentionally above the 120 s server maxDuration so the
  // server response always arrives before the client times out, unless the server
  // itself hangs. A client-side abort at ≤ 120 s would silently discard a review
  // the server already completed (non-retryable wasted charge).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 130_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/review`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // Retryable — server may not have started processing yet.
      throw new Error("Review timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    if (res.status === 402) throw new PaywallError(json?.error);
    throw new Error(json?.error ?? "Review failed.");
  }
  return json.review as Review;
}
```

Add the ambient/local type to mirror the schema:

```ts
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
interface Review {
  documentType: string;
  summary: string;
  overallScore: number;
  highlights: string[];
  scoreBreakdown: { category: string; score: number; reason: string; recommendation: string }[];
  keyClauses: { title: string; content: string; assessment: string; riskLevel: RiskLevel }[];
  risks: { title: string; description: string; severity: RiskLevel; clause?: string; recommendation: string }[];
  recommendations: { title: string; description: string; priority: RiskLevel }[];
  fileName: string;
  tokensUsed: number;
  pageCount: number;
}
```

## Rendering

- Lead with `documentType`, `summary`, and `overallScore` (a gauge/ring).
- `scoreBreakdown` → per-category bars, each with its `reason` + `recommendation`.
- Color `keyClauses`/`risks` by `riskLevel`/`severity` (green/amber/red).
- Sort `risks` and `recommendations` `HIGH → MEDIUM → LOW`.

## Best practices

- **Pre-check size client-side** (`asset.size`) so a 10 MB+ pick fails instantly
  without a wasted upload.
- **Long timeout.** Analysis can take tens of seconds; set the fetch/abort timeout
  to ~120 s to match `maxDuration`, and show a determinate-ish progress state.
- **Map 402 to the paywall**, not a generic error.
- **Offer the file picker and the camera** (`expo-image-picker`) — photographing a
  paper contract hits the image/OCR path and works well.

## Gotchas

- **Never set `Content-Type` manually** — RN `FormData` must set the multipart
  boundary. Setting `application/json` or a bare `multipart/form-data` breaks the
  upload with an opaque 400/parse error.
- The RN `FormData` file part is `{ uri, name, type }` — not a web `File`/`Blob`.
- A 422 means the document had no readable text (encrypted PDF, blank scan) — guide
  the user to re-export or photograph it, don't just show "failed."
- This endpoint **does not persist** a review record itself — persisting is a
  separate step, exactly like transcription. To keep it in history: upload the
  source file to Firebase Storage, then `POST /reviews` (enveloped) with the
  returned review fields plus `fileUrl`:

  ```ts
  await apiFetch("/reviews", {
    method: "POST",
    body: JSON.stringify({
      fileName: review.fileName,
      fileUrl,                    // REQUIRED — Firebase Storage HTTPS URL only
      documentType: review.documentType,
      summary: review.summary,
      overallScore: review.overallScore,
      highlights: review.highlights,
      keyClauses: review.keyClauses,
      risks: review.risks,
      recommendations: review.recommendations,
      scoreBreakdown: review.scoreBreakdown,
      tokensUsed: review.tokensUsed,
      pageCount: review.pageCount,
    }),
  });
  ```

  **`fileUrl` is required and host-restricted.** It must be an **HTTPS** URL
  (≤2048 chars) on `firebasestorage.googleapis.com` or
  `storage.googleapis.com`; anything else — a local `file://` uri, an `http://`
  link, a third-party CDN, or omitting it entirely — is
  `400 fileUrl must be a valid HTTPS Firebase Storage URL`. **You must upload to
  Storage before you can save the review**, so there is no "save now, attach the
  file later" path. (Note the asymmetry: `POST /transcriptions/records` accepts any
  HTTPS `fileUrl` and treats it as optional.)

  Every other field is required too, with these caps: `fileName` 1–300,
  `documentType` 1–200, `summary` ≤20,000 chars, `overallScore` 0–100,
  `highlights` ≤200 items of ≤4,000 chars each, and `keyClauses` / `risks` /
  `recommendations` / `scoreBreakdown` ≤500 objects each. `tokensUsed` and
  `pageCount` must be non-negative integers. A violation is a generic
  `400 Invalid request body`, so pass the `review` object through unmodified rather
  than re-deriving these fields.

  Listing/reading/deleting saved reviews (`GET /reviews`, `GET /reviews/:id`,
  `DELETE /reviews/:id`) is in `account-and-history.md`.
