"use server";

import { getAuthenticatedUserId } from "./auth";
import * as reviewService from "@/services/review";

// ─── Save a completed document review ─────────────────────────────────────────
export async function saveDocumentReview(
  data: Omit<DocumentReview, "id" | "userId" | "createdAt" | "updatedAt">,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    return await reviewService.saveDocumentReview(data, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("saveDocumentReview action error:", error);
    return { success: false, error: error.message };
  }
}

// ─── Get paginated list of reviews for the current user ───────────────────────
export async function getDocumentReviews(
  limitCount = 9,
  beforeId?: string,
): Promise<{
  success: boolean;
  reviews: DocumentReview[];
  hasMore: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, reviews: [], hasMore: false, error: "Unauthorized" };

    return await reviewService.getDocumentReviews(limitCount, beforeId, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getDocumentReviews action error:", error);
    return { success: false, reviews: [], hasMore: false, error: error.message };
  }
}

// ─── Get a single review by ID ────────────────────────────────────────────────
export async function getDocumentReview(
  id: string,
): Promise<{
  success: boolean;
  review?: DocumentReview;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    return await reviewService.getDocumentReview(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getDocumentReview action error:", error);
    return { success: false, error: error.message };
  }
}

// ─── Delete a review ──────────────────────────────────────────────────────────
export async function deleteDocumentReview(
  id: string,
): Promise<{
  success: boolean;
  fileUrl?: string;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    return await reviewService.deleteDocumentReview(id, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("deleteDocumentReview action error:", error);
    return { success: false, error: error.message };
  }
}

// ─── Update a review ──────────────────────────────────────────────────────────
export async function updateDocumentReview(
  id: string,
  data: Partial<Omit<DocumentReview, "id" | "userId" | "createdAt" | "updatedAt">>,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return { success: false, error: "Unauthorized" };

    return await reviewService.updateDocumentReview(id, data, userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("updateDocumentReview action error:", error);
    return { success: false, error: error.message };
  }
}

