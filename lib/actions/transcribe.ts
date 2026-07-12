"use server";
import { getAuthenticatedUserId } from "./auth";
import { checkUserCanSend, recordUsageAndDeduct } from "./usage";
import { db } from "@/firebase/admin";
import {
  COLLECTIONS,
  CHARS_PER_TOKEN,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { generateText } from "ai";
import { vertex } from "./vertex";
import { GoogleLanguageModelOptions } from "@ai-sdk/google";

interface TranscribeDocumentParams {
  base64Data: string;
  mimeType: string;
  formatMode: "professional" | "original";
  fileName: string;
}

export async function transcribeDocument(params: TranscribeDocumentParams) {
  const { base64Data, mimeType, formatMode, fileName } = params;

  try {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      throw new Error("Unauthorized: Please sign in to transcribe documents.");
    }

    // 2. Credit Check
    const { canSend, reason, user } = await checkUserCanSend(userId);
    if (!canSend) {
      return {
        success: false,
        error: reason || "Insufficient tokens to process this document.",
        errorType: "INSUFFICIENT_CREDITS" as const,
      };
    }

    let estimatedInputTokens = 258; // default for images
    if (mimeType === "application/pdf") {
      const buffer = Buffer.from(base64Data, "base64");
      try {
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const parsed = await pdfParse(buffer);
        estimatedInputTokens = Math.ceil(parsed.text.length / CHARS_PER_TOKEN);
      } catch (e) {
        console.error("PDF parse error:", e);
        // Fallback estimation
        estimatedInputTokens = Math.ceil(buffer.length / 3);
      }
    }

    const estimatedOutputTokens = estimatedInputTokens + 500;
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    const freeTokens =
      (user?.freeTextTokens ?? 0) + (user?.welcomeTextTokens ?? 0);
    const balanceDerivedTokens = Math.floor(
      ((user?.balance ?? 0) / COST_PER_THOUSAND_TOKENS_IN_CENTS) * 1000,
    );
    const totalAvailableTokens = freeTokens + balanceDerivedTokens;

    if (estimatedTotalTokens > totalAvailableTokens) {
      return {
        success: false,
        error: `Insufficient tokens. This document requires ~${estimatedTotalTokens.toLocaleString()} tokens but you only have ~${totalAvailableTokens.toLocaleString()} available. Please add funds or reduce document size.`,
        errorType: "INSUFFICIENT_CREDITS" as const,
      };
    }

    const basePrompt =
      "CRITICAL INSTRUCTION: Output ONLY the transcribed text. Do NOT include any conversational filler, introductory text, or labels like 'Here is the transcription...'. ";

    const prompt =
      formatMode === "professional"
        ? basePrompt +
          `Transcribe all text from this document, including both computer-typed and handwritten parts. If the document is a quotation, receipt, memo, or similar form, return the exact content including date, company name, location, receipt number, etc., where applicable. Add relevant formatting to make it look highly professional, well-structured, and clean (using paragraphs, bold, italic, etc.), but do NOT divert from the original document's meaning or facts. Do NOT add any sections, information, or content that is not present in the original document. Correct obvious spelling or grammatical errors in the handwritten parts only.`
        : basePrompt +
          `Transcribe all text from this document (both typed and handwritten) exactly as it appears. Maintain the original structure, line breaks, and formatting as closely as possible. Do not add any new headings or correct errors unless they are completely illegible.`;

     const { text, usage } = await generateText({
        model: vertex("gemini-3.1-flash-lite"),
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: prompt 
              },
              { 
                type: "file", 
                data: Buffer.from(base64Data, "base64"),      
                mediaType: mimeType,    
              }
            ],
          },
        ],
 
        providerOptions: {
          vertexai: { 
            thinkingConfig: {
              thinkingConfig: {
                thinkingLevel: "medium",
              },
            } satisfies GoogleLanguageModelOptions,
          },
        },

        onEnd: async ({usage}) => {
           // 5. Record Usage
          const totalTokens = usage?.totalTokens || 0;
          await recordUsageAndDeduct({
            userId: userId,
            type: "DOCUMENT_TRANSCRIPTION",
            tokens: totalTokens,
            sessionId: `doc-${fileName}-${Date.now()}`,
          });
        }
      });

    if (!text) {
      throw new Error("Failed to generate transcription from Gemini.");
    }

    return {
      success: true,
      text,
      totalTokens: usage?.totalTokens || 0,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("--- Server Transcribe Error ---", error);
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
      throw new Error("Unauthorized");
    }

    const { id, ...updateData } = data;
    const now = FieldValue.serverTimestamp();

    if (id) {
      const docRef = db.collection(COLLECTIONS.TRANSCRIPTIONS).doc(id);
      const doc = await docRef.get();
      if (!doc.exists || doc.data()?.userId !== userId) {
        throw new Error("Unauthorized or Transcription not found");
      }
      await docRef.update({
        ...updateData,
        updatedAt: now,
      });
      return { success: true, id };
    } else {
      const docRef = db.collection(COLLECTIONS.TRANSCRIPTIONS).doc();
      await docRef.set({
        ...updateData,
        userId,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id: docRef.id };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error saving transcription:", error);
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
      throw new Error("Unauthorized");
    }

    let collectionRef: FirebaseFirestore.Query = db
      .collection(COLLECTIONS.TRANSCRIPTIONS)
      .where("userId", "==", userId);

    if (timeRange && timeRange !== "all") {
      const now = new Date();
      let filterDate: Date;
      if (timeRange === "24h") {
        filterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === "7d") {
        filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        filterDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      collectionRef = collectionRef.where("createdAt", ">=", filterDate);
    }

    if (searchQuery) {
      // Very basic prefix search since Firestore lacks full text search
      // Using \uf8ff to get items that start with searchQuery
      collectionRef = collectionRef
        .where("title", ">=", searchQuery)
        .where("title", "<=", searchQuery + "\uf8ff");
    }

    // Always sort by createdAt desc unless restricted by inequality constraints.
    // If searching by title, we need to order by title first, then createdAt
    if (searchQuery) {
      collectionRef = collectionRef
        .orderBy("title")
        .orderBy("createdAt", "desc");
    } else {
      collectionRef = collectionRef.orderBy("createdAt", "desc");
    }

    if (beforeId) {
      const cursorDoc = await db
        .collection(COLLECTIONS.TRANSCRIPTIONS)
        .doc(beforeId)
        .get();
      if (cursorDoc.exists) {
        collectionRef = collectionRef.startAfter(cursorDoc);
      }
    }

    const snapshot = await collectionRef.limit(limitCount + 1).get();

    const hasMore = snapshot.docs.length > limitCount;
    const docs = hasMore ? snapshot.docs.slice(0, limitCount) : snapshot.docs;

    const transcriptions = docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        doc.data().updatedAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as TranscriptionRecord[];

    return { success: true, transcriptions, hasMore };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error getting transcriptions:", error);
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
      throw new Error("Unauthorized");
    }

    const doc = await db.collection(COLLECTIONS.TRANSCRIPTIONS).doc(id).get();

    if (!doc.exists || doc.data()?.userId !== userId) {
      return { success: false, error: "Transcription not found" };
    }

    const data = doc.data();
    const record = {
      ...data,
      id: doc.id,
      createdAt:
        data?.createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt:
        data?.updatedAt?.toDate().toISOString() || new Date().toISOString(),
    } as TranscriptionRecord;

    return { success: true, record };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error getting transcription:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTranscriptionRecord(id: string): Promise<{
  success: boolean;
  error?: string;
  fileUrl?: string;
}> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const docRef = db.collection(COLLECTIONS.TRANSCRIPTIONS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { success: false, error: "Transcription not found" };
    }

    if (doc.data()?.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    const fileUrl = doc.data()?.fileUrl as string;

    await docRef.delete();

    return { success: true, fileUrl };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error deleting transcription:", error);
    return { success: false, error: error.message };
  }
}
