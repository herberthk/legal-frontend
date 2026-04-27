"use server";

import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUserId } from "./auth";
import { checkUserCanSend, recordUsageAndDeduct } from "./usage";

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
    const { canSend, reason } = await checkUserCanSend(userId);
    if (!canSend) {
      return {
        success: false,
        error: reason || "Insufficient tokens to process this document.",
        errorType: "INSUFFICIENT_CREDITS" as const,
      };
    }

    // 3. Initialize Gemini
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const basePrompt =
      "CRITICAL INSTRUCTION: Output ONLY the transcribed text. Do NOT include any conversational filler, introductory text, or labels like 'Here is the transcription...'. ";

    const prompt =
      formatMode === "professional"
        ? basePrompt +
          `Transcribe all text from this document, including both computer-typed and handwritten parts. If the document is a quotation, receipt, memo, or similar form, return the exact content including date, company name, location, receipt number, etc., where applicable. Add relevant formatting to make it look highly professional, well-structured, and clean (using paragraphs, bold, italic, etc.), but do NOT divert from the original document's meaning or facts. Do NOT add any sections, information, or content that is not present in the original document. Correct obvious spelling or grammatical errors in the handwritten parts only.`
        : basePrompt +
          `Transcribe all text from this document (both typed and handwritten) exactly as it appears. Maintain the original structure, line breaks, and formatting as closely as possible. Do not add any new headings or correct errors unless they are completely illegible.`;

    // 4. Generate Content
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    });

    const text = result.text;

    if (!text) {
      throw new Error("Failed to generate transcription from Gemini.");
    }

    // 5. Record Usage
    const totalTokens = result.usageMetadata?.totalTokenCount || 0;
    await recordUsageAndDeduct({
      userId: userId,
      type: "DOCUMENT_TRANSCRIPTION",
      tokens: totalTokens,
      sessionId: `doc-${fileName}-${Date.now()}`,
    });

    return {
      success: true,
      text,
      totalTokens,
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
