import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import {
  getTranscriptionRecord,
  deleteTranscriptionRecord,
  renameTranscriptionRecord,
} from "@/services/transcribe";
import { ok, badRequest, notFoundError, internalError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/transcriptions/:id` — one transcription record.
 * `PATCH /api/v1/transcriptions/:id` — lightweight title rename without resending `transcribedText`.
 * `DELETE /api/v1/transcriptions/:id` — deletes it and returns the stored
 * `fileUrl` so the client can remove the Storage object itself.
 *
 * All actions enforce ownership internally via the passed uid; a missing or
 * not-owned id surfaces as 404 (never 403) so ids can't be probed for existence.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const result = await getTranscriptionRecord(id, gate.userId);
  if (!result.success) {
    return notFoundError(result.error || "Transcription not found.");
  }
  return ok(result);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const { id } = await params;
  const result = await deleteTranscriptionRecord(id, gate.userId);
  if (!result.success) {
    return notFoundError(result.error || "Transcription not found.");
  }
  return ok(result);
}

const MAX_RENAME_BODY_BYTES = 8 * 1024;

const renameSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_RENAME_BODY_BYTES) {
      return badRequest("Payload too large. Request body must be 8 KB or less.");
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid request body");
  }

  const { id } = await params;
  const result = await renameTranscriptionRecord(
    id,
    parsed.data.title,
    gate.userId,
  );
  if (!result.success) {
    if (result.notFound) {
      return notFoundError(result.error || "Transcription not found.");
    }
    return internalError(result.error || "Failed to rename transcription.");
  }
  return ok({ success: true, id: result.id, title: result.title });
}
