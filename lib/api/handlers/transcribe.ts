import { z } from "zod";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/api/read-bounded-json";
import { transcribeDocument } from "@/services/transcribe";
import { STORAGE_PATHS } from "@/constants/buckets";

// Request payloads only contain short JSON metadata (storagePath, mimeType, formatMode, fileName).
// 32 KB is more than enough for metadata while guarding against oversized body attacks.
const MAX_BODY_BYTES = 32 * 1024;

export const transcribePostSchema = z.object({
  storagePath: z
    .string()
    .min(1, "storagePath must be a non-empty string")
    .max(1024),
  mimeType: z
    .string()
    .transform((val) =>
      val.toLowerCase() === "image/jpg" ? "image/jpeg" : val.toLowerCase(),
    )
    .pipe(
      z.enum(
        ["application/pdf", "image/png", "image/jpeg", "image/webp"],
        {
          message:
            "Unsupported mimeType. Accepted values: application/pdf, image/png, image/jpeg, image/webp.",
        },
      ),
    ),
  formatMode: z.enum(["professional", "original"], {
    message: 'formatMode must be "professional" or "original".',
  }),
  fileName: z
    .string()
    .min(1, "fileName is required")
    .max(300, "fileName must be 300 characters or less"),
});

export type TranscribePostInput = z.infer<typeof transcribePostSchema>;

/**
 * Shared core of the document-transcription endpoint.
 *
 * The web route (`app/api/transcribe/route.ts`) and the mobile route
 * (`app/api/v1/transcriptions/route.ts`) both enforce Firebase App Check as
 * step 0 and share this validation schema and transcription pipeline.
 *
 * The client uploads the file directly to Firebase Storage under
 * `temp/transcriptions/${userId}/…`, then passes only the resulting
 * `storagePath` in the JSON body — keeping the request well under Vercel's
 * 4.5 MB serverless payload limit regardless of file size.
 */
export async function handleTranscribeRequest(
  req: Request,
  userId: string,
): Promise<Response> {
  let body: unknown;
  try {
    body = await readBoundedJson(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: "Payload too large. Request body must be 32 KB or less." },
        { status: 413 },
      );
    }
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // 2. Validate with Zod schema
  const parsed = transcribePostSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid request body.";
    return Response.json({ error: firstIssue }, { status: 400 });
  }

  // 3. Security check: prevent path traversal and enforce user-specific temp-folder ownership (must reference a file, not a directory)
  const cleanPath = parsed.data.storagePath.trim();
  const expectedPrefix = `${STORAGE_PATHS.TRANSCRIPTIONS_TEMP}/${userId}/`;
  if (
    cleanPath.includes("..") ||
    cleanPath.startsWith("/") ||
    !cleanPath.startsWith(expectedPrefix) ||
    cleanPath === expectedPrefix ||
    cleanPath.endsWith("/")
  ) {
    return Response.json(
      {
        error:
          "Invalid storage path. Path must reference a valid file in your temporary transcriptions folder.",
      },
      { status: 400 },
    );
  }

  // 4. Delegate to the service (credit check, AI call, usage deduction)
  const result = await transcribeDocument(parsed.data, userId);

  if (!result.success) {
    if (result.errorType === "INSUFFICIENT_CREDITS") {
      return Response.json({ error: result.error }, { status: 402 });
    }
    if (result.errorType === "CORRUPT_FILE") {
      return Response.json({ error: result.error }, { status: 422 });
    }
    return Response.json(
      { error: result.error || "Transcription failed." },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    text: result.text,
    totalTokens: result.totalTokens,
  });
}
