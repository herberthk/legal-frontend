import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";

// ─── Save a completed document review ─────────────────────────────────────────
export async function saveDocumentReview(
  data: Omit<DocumentReview, "id" | "userId" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!userId) throw new Error("Unauthorized");

    const docRef = db.collection(COLLECTIONS.DOCUMENT_REVIEWS).doc();
    await docRef.set({
      ...data,
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: docRef.id };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("saveDocumentReview error:", error);
    return { success: false, error: "Failed to save document review" };
  }
}

// ─── Get paginated list of reviews for a user ─────────────────────────────────
export async function getDocumentReviews(
  limitCount = 9,
  beforeId: string | undefined,
  userId: string,
): Promise<{
  success: boolean;
  reviews: DocumentReview[];
  hasMore: boolean;
  error?: string;
}> {
  try {
    if (!userId) throw new Error("Unauthorized");

    let query: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.DOCUMENT_REVIEWS)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");

    if (beforeId) {
      const cursorDoc = await db
        .collection(COLLECTIONS.DOCUMENT_REVIEWS)
        .doc(beforeId)
        .get();
      if (!cursorDoc.exists || cursorDoc.data()?.userId !== userId) {
        return {
          success: false,
          reviews: [],
          hasMore: false,
          error: "Invalid pagination cursor",
        };
      }
      query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.limit(limitCount + 1).get();
    const hasMore = snapshot.docs.length > limitCount;
    const docs = hasMore ? snapshot.docs.slice(0, limitCount) : snapshot.docs;

    const reviews: DocumentReview[] = docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt:
          data.createdAt?.toDate().toISOString() || new Date().toISOString(),
        updatedAt:
          data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
      } as DocumentReview;
    });

    return { success: true, reviews, hasMore };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getDocumentReviews error:", error);
    return {
      success: false,
      reviews: [],
      hasMore: false,
      error: "Failed to retrieve document reviews",
    };
  }
}

// ─── Get a single review by ID ────────────────────────────────────────────────
export async function getDocumentReview(
  id: string,
  userId: string,
): Promise<{
  success: boolean;
  notFound?: boolean;
  review?: DocumentReview;
  error?: string;
}> {
  try {
    if (!userId) throw new Error("Unauthorized");

    const doc = await db
      .collection(COLLECTIONS.DOCUMENT_REVIEWS)
      .doc(id)
      .get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return { success: false, notFound: true, error: "Review not found" };
    }

    const data = doc.data()!;
    const review: DocumentReview = {
      ...data,
      id: doc.id,
      createdAt:
        data.createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt:
        data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
    } as DocumentReview;

    return { success: true, review };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getDocumentReview error:", error);
    return { success: false, error: "Failed to retrieve document review" };
  }
}

// ─── Delete a review ──────────────────────────────────────────────────────────
export async function deleteDocumentReview(
  id: string,
  userId: string,
): Promise<{
  success: boolean;
  notFound?: boolean;
  fileUrl?: string;
  error?: string;
}> {
  try {
    if (!userId) throw new Error("Unauthorized");

    const docRef = db.collection(COLLECTIONS.DOCUMENT_REVIEWS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return { success: false, notFound: true, error: "Review not found" };
    }

    const fileUrl = doc.data()?.fileUrl as string | undefined;
    await docRef.delete();

    return { success: true, fileUrl };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("deleteDocumentReview error:", error);
    return { success: false, error: "Failed to delete document review" };
  }
}

// ─── Update a review ──────────────────────────────────────────────────────────
export async function updateDocumentReview(
  id: string,
  data: Partial<Omit<DocumentReview, "id" | "userId" | "createdAt" | "updatedAt">>,
  userId: string,
): Promise<{
  success: boolean;
  notFound?: boolean;
  error?: string;
}> {
  try {
    if (!userId) throw new Error("Unauthorized");

    const docRef = db.collection(COLLECTIONS.DOCUMENT_REVIEWS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return { success: false, notFound: true, error: "Review not found" };
    }

    await docRef.update({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("updateDocumentReview error:", error);
    return { success: false, error: "Failed to update document review" };
  }
}
