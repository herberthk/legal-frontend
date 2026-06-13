import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { checkUserCanSend, recordUsageAndDeduct } from "@/lib/actions/usage";
import {
  LEGAL_DOCUMENT_REVIEW_PROMPT,
  CHARS_PER_TOKEN,
  MAX_REVIEW_FILE_SIZE,
  MAX_REVIEW_PAGES,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    // 1. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    // 2. Validate file size
    if (file.size > MAX_REVIEW_FILE_SIZE) {
      return Response.json(
        {
          error: `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        },
        { status: 400 },
      );
    }

    // 3. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    // 4. Convert file to Buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Extract text via pdf-parse
    let extractedText = "";
    let pageCount = 0;
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        // Dynamic import to avoid edge runtime issues
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text;
        pageCount = parsed.numpages;
      } else if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        // docx doesn't give a simple page count, so we'll just approximate it or set it to 1
        pageCount = Math.max(1, Math.ceil(extractedText.length / 3000));
      } else {
        return Response.json({ error: "Unsupported file type. Please upload a PDF or DOCX file." }, { status: 400 });
      }
    } catch (error) {
      console.error("Document parsing error:", error);
      return Response.json(
        {
          error:
            "Failed to read document. Please ensure the file is valid and non-encrypted.",
        },
        { status: 422 },
      );
    }

    // 6. Validate page count
    if (pageCount > MAX_REVIEW_PAGES) {
      return Response.json(
        {
          error: `Document has ${pageCount} pages. Maximum allowed is ${MAX_REVIEW_PAGES} pages.`,
        },
        { status: 400 },
      );
    }

    if (!extractedText.trim()) {
      return Response.json(
        {
          error:
            "No readable text found in the document. The file may be image-only or scanned without OCR.",
        },
        { status: 422 },
      );
    }

    // 7. Token estimation and credit check
    const estimatedInputTokens = Math.ceil(
      extractedText.length / CHARS_PER_TOKEN,
    );
    const estimatedOutputTokens = 2000; // structured JSON output
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    const { canSend, reason, user } = await checkUserCanSend(userId);
    if (!canSend) {
      return Response.json({ error: reason }, { status: 402 });
    }

    // Calculate total available tokens for this user
    const freeTokens =
      (user?.freeTextTokens ?? 0) + (user?.welcomeTextTokens ?? 0);
    const balanceDerivedTokens = Math.floor(
      ((user?.balance ?? 0) / COST_PER_THOUSAND_TOKENS_IN_CENTS) * 1000,
    );
    const totalAvailableTokens = freeTokens + balanceDerivedTokens;

    if (estimatedTotalTokens > totalAvailableTokens) {
      return Response.json(
        {
          error: `Insufficient tokens. This document requires ~${estimatedTotalTokens.toLocaleString()} tokens but you only have ~${totalAvailableTokens.toLocaleString()} available. Please add funds or reduce document size.`,
        },
        { status: 402 },
      );
    }

    // 8. Build prompt with extracted text
    const systemPrompt = LEGAL_DOCUMENT_REVIEW_PROMPT(file.name);
    const userMessage = `DOCUMENT TEXT:\n\n${extractedText}`;

    // 9. Call Gemini for deep legal analysis using structured output
    const { object: reviewData, usage } = await generateObject({
      model: google("gemini-3-flash-preview"),
      system: systemPrompt,
      prompt: userMessage,
      schema: z.object({
        documentType: z.string(),
        summary: z.string(),
        overallScore: z.number().min(0).max(100),
        highlights: z.array(z.string()),
        scoreBreakdown: z.array(
          z.object({
            category: z.string(),
            score: z.number().min(0).max(100),
          }),
        ),
        keyClauses: z.array(
          z.object({
            title: z.string(),
            content: z.string(),
            assessment: z.string(),
            riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
          }),
        ),
        risks: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
            clause: z.string().optional(),
            recommendation: z.string(),
          }),
        ),
        recommendations: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
          }),
        ),
      }),
    });

    // 10. Record token usage and deduct
    const actualTokens =
      (usage?.inputTokens ?? estimatedInputTokens) +
      (usage?.outputTokens ?? estimatedOutputTokens);

    await recordUsageAndDeduct({
      userId,
      type: "DOCUMENT_TRANSCRIPTION",
      tokens: actualTokens,
      sessionId: `review-${file.name}-${Date.now()}`,
    });

    // 12. Return the structured review + metadata
    return Response.json({
      success: true,
      review: {
        ...reviewData,
        fileName: file.name,
        tokensUsed: actualTokens,
        pageCount,
      },
    });
  } catch (error) {
    console.error("Review API error:", error);
    return Response.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
