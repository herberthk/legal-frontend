import { requireMobileAuth } from "@/lib/api/v1/guard";
import {
  getTranscriptionRecord,
  deleteTranscriptionRecord,
} from "@/services/transcribe";
import { ok, notFoundError } from "@/lib/api/v1/response";

/**
 * `GET /api/v1/transcriptions/:id` — one transcription record.
 * `DELETE /api/v1/transcriptions/:id` — deletes it and returns the stored
 * `fileUrl` so the client can remove the Storage object itself.
 *
 * Both actions enforce ownership internally via the passed uid; a missing or
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
