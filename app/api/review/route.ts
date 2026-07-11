import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from 'zod/v3';
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

// Cache dynamic imports so they are only loaded once per cold start, reducing per-request latency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPdfParse: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedMammoth: any = null;

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

    // 4. Parallelize file buffering and user permission checks
    // We check canSend EARLY to prevent malicious users from triggering expensive Gemini OCR calls
    const [arrayBuffer, userCheck] = await Promise.all([
      file.arrayBuffer(),
      checkUserCanSend(userId)
    ]);

    const { canSend, reason, user } = userCheck;
    if (!canSend) {
      return Response.json({ error: reason }, { status: 402 });
    }

    const buffer = Buffer.from(arrayBuffer);

    // 5. Extract text from the document
    let extractedText = "";
    let pageCount = 0;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx");
    const isImage = file.type.startsWith("image/");

    if (isImage) {
      // Images (screenshots, scanned photos) go directly to Gemini vision OCR — no text layer to parse.
      try {
        console.log(`Image upload detected (${file.type}) — running Gemini OCR directly...`);
        const { text: ocrText } = await generateText({
          model: google("gemini-3.1-flash-lite"),
          temperature: 0,
          messages: [
            {
              role: "user",

              content: [
                {
                  type: "file",
                  data: buffer.toString("base64"),
                  mediaType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                },
                {
                  type: "text",
                  text: "This is a scanned legal document or screenshot. Please extract ALL visible text from this image exactly as it appears, preserving headings, paragraph structure, clause numbers, signatures, dates, and any tabular data. Output only the extracted text with no commentary.",
                },
              ]
            },
          ],
        });
        if (ocrText && ocrText.trim().length > 50) {
          extractedText = ocrText;
          pageCount = 1; // Images are single-page by nature
        } else {
          return Response.json(
            { error: "Could not extract readable text from this image. Please ensure the image is clear and contains visible text." },
            { status: 422 },
          );
        }
      } catch (imgOcrError) {
        console.error("Gemini image OCR failed:", imgOcrError);
        return Response.json(
          { error: "Failed to process this image. Please try a clearer scan or a PDF/DOCX file." },
          { status: 422 },
        );
      }
    } else {
      try {
        if (isPdf) {
          if (!cachedPdfParse) {
            const pdfParseModule = await import("pdf-parse");
            cachedPdfParse = pdfParseModule.default || pdfParseModule;
          }
          const parsed = await cachedPdfParse(buffer);
          extractedText = parsed.text;
          pageCount = parsed.numpages;
        } else if (isDocx) {
          if (!cachedMammoth) {
            cachedMammoth = await import("mammoth");
          }
          const result = await cachedMammoth.extractRawText({ buffer });
          extractedText = result.value;
          pageCount = Math.max(1, Math.ceil(extractedText.length / 3000));
        } else {
          return Response.json(
            { error: "Unsupported file type. Please upload a PDF, DOCX, or image file (PNG/JPG/WEBP)." },
            { status: 400 },
          );
        }
      } catch (error) {
        console.error("Document parsing error:", error);
        return Response.json(
          { error: "Failed to read document. Please ensure the file is valid and non-encrypted." },
          { status: 422 },
        );
      }
    }

    // 6. Validate page count (images are always page 1, skip if already processed as image)
    if (!isImage && pageCount > MAX_REVIEW_PAGES) {
      return Response.json(
        {
          error: `Document has ${pageCount} pages. Maximum allowed is ${MAX_REVIEW_PAGES} pages.`,
        },
        { status: 400 },
      );
    }

    // 7. OCR fallback for scanned PDFs: if pdf-parse yielded too little text, use Gemini vision.
    // (Images are already handled above — this block only runs for PDFs/DOCX.)
    const MIN_TEXT_LENGTH = 100;
    const isScanned = !isImage && (!extractedText.trim() || extractedText.trim().length < MIN_TEXT_LENGTH);
    
    if (isScanned && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      try {
        console.log("Detected scanned/image-only PDF — attempting Gemini OCR...");
        const { text: ocrText } = await generateText({
          model: google("gemini-3.1-flash-lite"),
          temperature: 0,
          messages: [
            {
              role: "user",

              content: [
                {
                  type: "file",
                  data: buffer.toString("base64"),
                  mediaType: "application/pdf",
                },

                {
                  type: "text",
                  text: "This is a scanned legal document. Please extract ALL visible text from every page of this document exactly as it appears, preserving headings, paragraph structure, clause numbers, and any tabular data. Output only the extracted text with no commentary.",
                },
              ]
            },
          ],
        });
        if (ocrText && ocrText.trim().length > 50) {
          extractedText = ocrText;
          // Approximate page count from OCR output length
          if (pageCount === 0) pageCount = Math.max(1, Math.ceil(extractedText.length / 3000));
        } else {
          return Response.json(
            { error: "Could not extract text from this scanned document. Please ensure the scan quality is sufficient or use a text-based PDF." },
            { status: 422 },
          );
        }
      } catch (ocrError) {
        console.error("Gemini OCR fallback failed:", ocrError);
        return Response.json(
          { error: "Failed to process scanned document. Please try a text-based PDF or DOCX instead." },
          { status: 422 },
        );
      }
    } else if (isScanned) {
      // DOCX with no text
      return Response.json(
        { error: "No readable text found in the document. Please ensure the file is a valid, non-corrupted document." },
        { status: 422 },
      );
    }

    // 8. Token estimation and credit check
    const estimatedInputTokens = Math.ceil(
      extractedText.length / CHARS_PER_TOKEN,
    );
    const estimatedOutputTokens = 2000; // structured JSON output
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

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

    // 9. Build prompt with extracted text
    const systemPrompt = LEGAL_DOCUMENT_REVIEW_PROMPT(file.name);
    const userMessage = `DOCUMENT TEXT:\n\n${extractedText}`;

    // 9. Call Gemini for deep legal analysis using structured output
    const { output: reviewData, usage } = await generateText({
      model: google("gemini-3-flash-preview"),
      temperature: 0,
      instructions: systemPrompt,
      prompt: userMessage,
      output: Output.object({
        schema:  z.object({
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
      }) 
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
