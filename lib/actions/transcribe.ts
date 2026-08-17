"use server";

import { getAuthenticatedUserId } from "./auth";
import * as transcribeService from "@/services/transcribe";
import type { TranscribeDocumentParams } from "@/services/transcribe";

export async function transcribeDocument(
  params: TranscribeDocumentParams,
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized: Please sign in to transcribe documents.",
        errorType: "GENERAL" as const,
      };
    }

    return await transcribeService.transcribeDocument(params, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("--- Server Action Transcribe Error ---", error);
    return {
      success: false,
      error:
        error.message || "An unexpected error occurred during transcription.",
      errorType: "GENERAL" as const,
    };
  }
}

export async function saveTranscriptionRecord(
  data: Omit<
    TranscriptionRecord,
    "id" | "createdAt" | "updatedAt" | "userId"
  > & { id?: string },
) {
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
) {
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

export async function getTranscriptionRecord(id: string) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    return await transcribeService.getTranscriptionRecord(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error getting transcription action:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTranscriptionRecord(
  id: string,
): Promise<{
  success: boolean;
  error?: string;
  fileUrl?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    return await transcribeService.deleteTranscriptionRecord(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error deleting transcription action:", error);
    return { success: false, error: error.message };
  }
}

