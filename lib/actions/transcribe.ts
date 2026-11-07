"use server";

import { getAuthenticatedUserId } from "./auth";
import * as transcribeService from "@/services/transcribe";

// NOTE: `transcribeDocument` is intentionally NOT a Server Action.
// It is handled by the App Check-enforced API route at `POST /api/transcribe`
// (web) and `POST /api/v1/transcriptions` (mobile), which parallel the pattern
// used by chat and document-review. This keeps App Check enforcement consistent
// across all AI-metered endpoints.

export async function saveTranscriptionRecord(
  data: Omit<
    TranscriptionRecord,
    "id" | "createdAt" | "updatedAt" | "userId"
  > & { id?: string; tempStoragePath?: string },
): Promise<{
  success: boolean;
  id?: string;
  notFound?: boolean;
  error?: string;
  fileUrl?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    return await transcribeService.saveTranscriptionRecord(data, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error saving transcription action:", error);
    return { success: false, error: error.message };
  }
}

export async function getTranscriptions(
  limitCount = 10,
  beforeId?: string,
  searchQuery?: string,
  timeRange?: "24h" | "7d" | "30d" | "all",
): Promise<{
  success: boolean;
  transcriptions: TranscriptionRecord[];
  hasMore: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return {
        success: false,
        transcriptions: [],
        hasMore: false,
        error: "Unauthorized",
      };
    }

    return await transcribeService.getTranscriptions(
      limitCount,
      beforeId,
      searchQuery,
      timeRange,
      userId,
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error getting transcriptions action:", error);
    return {
      success: false,
      transcriptions: [],
      hasMore: false,
      error: error.message,
    };
  }
}

export async function getTranscriptionRecord(id: string): Promise<{
  success: boolean;
  record?: TranscriptionRecord;
  notFound?: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, notFound: false, error: "Unauthorized" };
    }

    return await transcribeService.getTranscriptionRecord(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error getting transcription action:", error);
    return { success: false, notFound: false, error: error.message };
  }
}

export async function deleteTranscriptionRecord(
  id: string,
): Promise<{
  success: boolean;
  notFound?: boolean;
  error?: string;
  fileUrl?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, notFound: false, error: "Unauthorized" };
    }

    return await transcribeService.deleteTranscriptionRecord(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error deleting transcription action:", error);
    return { success: false, notFound: false, error: error.message };
  }
}

