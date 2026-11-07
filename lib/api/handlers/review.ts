import {
  APICallError,
  generateText,
  NoObjectGeneratedError,
  Output,
  ModelMessage,
  RetryError,
} from "ai";
import { z } from "zod";
import { checkUserCanSend, recordUsageAndDeduct } from "@/lib/actions/usage";
import {
  LEGAL_DOCUMENT_REVIEW_PROMPT,
  CHARS_PER_TOKEN,
  MAX_REVIEW_FILE_SIZE,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";
import { vertex } from "@/lib/actions/vertex";

/**
 * Shared core of the document-review endpoint.
 *
 * The web route (`app/api/review/route.ts`) and the mobile route
 * (`app/api/v1/review/route.ts`) are identical from this point on — they differ
 * ONLY in how `userId` is resolved (session cookie vs. Bearer ID token) and how
 * App Check is checked, both handled by the caller. Everything billing-critical
 * (file validation, extraction, the `generateText` call, and the deduction)
 * lives here so it can never drift between the two surfaces.
 *
 * Behaviour is byte-for-byte the previous web handler; do not change it without
 * re-verifying the web review flow.
 */

import { extractDocumentText } from "@/lib/document-extractor";
import {
  sanitizeFilename,
  sanitizeUntrustedDocumentText,
  wrapDocumentForModel,
} from "@/lib/security/sanitizer";
import sharp from "sharp";

// Static schema declaration to avoid recreating validation objects on every request
const legalReviewSchema = z.object({
  documentType: z
    .string()
    .describe(
      "The type of legal document (e.g., Lease Agreement, NDA, Employment Contract)",
    ),
  summary: z.string().describe("A concise summary of the document"),
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall fairness/risk score for the document (0-100)"),
  highlights: z.array(z.string()).describe("Key highlights of the document"),
  scoreBreakdown: z.array(
    z.object({
      category: z
        .string()
        .describe(
          "The category of the score (e.g., Fairness, Clarity, Completeness)",
        ),
      score: z
        .number()
        .min(0)
        .max(100)
        .describe("The score for the category (0-100)"),
      reason: z
        .string()
        .describe(
          "The detailed reason for why this specific score was given based on the document's contents",
        ),
      recommendation: z
        .string()
        .describe(
          "Specific and actionable recommendations on how to achieve 100% in this category",
        ),
    }),
  ),
  keyClauses: z.array(
    z.object({
      title: z.string().describe("The title of the key clause"),
      content: z.string().describe("The content of the key clause"),
      assessment: z.string().describe("The assessment of the key clause"),
      riskLevel: z
        .enum(["LOW", "MEDIUM", "HIGH"])
        .describe("The risk level of the key clause (LOW, MEDIUM, HIGH)"),
    }),
  ),
  risks: z.array(
    z.object({
      title: z.string().describe("The title of the risk"),
      description: z.string().describe("The description of the risk"),
      severity: z
        .enum(["LOW", "MEDIUM", "HIGH"])
        .describe("The severity of the risk (LOW, MEDIUM, HIGH)"),
      clause: z
        .string()
        .optional()
        .describe("The clause associated with the risk"),
      recommendation: z.string().describe("The recommendation for the risk"),
    }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string().describe("The title of the recommendation"),
      description: z.string().describe("The description of the recommendation"),
      priority: z
        .enum(["LOW", "MEDIUM", "HIGH"])
        .describe("The priority of the recommendation (LOW, MEDIUM, HIGH)"),
    }),
  ),
});

export async function handleReviewRequest(
  req: Request,
  userId: string,
): Promise<Response> {
  try {
    // 2. Validate early user permission check to prevent malicious payload parsing
    const { canSend, reason, user } = await checkUserCanSend(userId);
    if (!canSend) {
      return Response.json({ error: reason }, { status: 402 });
    }

    // 3. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    // Security: Sanitize filename against XSS, HTML injection, path traversal,
    // and prompt injection delimiters before it is embedded into the system prompt.
    const safeFilename = sanitizeFilename(file.name || "document");

    // 4. Validate file size
    if (file.size > MAX_REVIEW_FILE_SIZE) {
      return Response.json(
        {
          error: `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
        },
        { status: 400 },
      );
    }

    // 5. Determine and check supported file types before buffer allocation
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isDocx && !isImage) {
      return Response.json(
        {
          error:
            "Unsupported file type. Please upload a PDF, DOCX, or image file (PNG/JPG/WEBP).",
        },
        { status: 400 },
      );
    }

    // 6. Buffer the file in memory since the request is authenticated and valid
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Estimate input tokens and count pages based on file type
    let estimatedInputTokens = 0;
    let pageCount = 1;
    let extractedText = "";
    let useMultimodalFile = false;
    let modelPayloadBuffer = buffer;
    let modelPayloadMimeType = isPdf ? "application/pdf" : file.type;

    if (isImage) {
      estimatedInputTokens = 1000;
      pageCount = 1;
      useMultimodalFile = true;
      try {
        modelPayloadBuffer = await sharp(buffer)
          .rotate()
          .flatten({ background: "#ffffff" })
          .toColorspace("srgb")
          .jpeg({ quality: 92 })
          .toBuffer();
        modelPayloadMimeType = "image/jpeg";
      } catch (sharpError) {
        console.warn(
          "[review] Sharp image normalization failed, using raw buffer:",
          sharpError,
        );
      }
    } else {
      try {
        const extracted = await extractDocumentText(buffer, isPdf ? "pdf" : "docx");
        pageCount = extracted.pageCount;

        if (isPdf) {
          if (extracted.isScannedPdf) {
            // Scanned PDF: Fall back to native visual file upload
            useMultimodalFile = true;
            estimatedInputTokens = extracted.estimatedTokens;
          } else {
            // Text-based PDF: Sanitize extracted text with DOMPurify + prompt injection defense
            // before sending to the model to prevent XSS and prompt injection via document content.
            const { sanitizedText, hasInjectionAttempt, detectedThreats } =
              sanitizeUntrustedDocumentText(extracted.text, safeFilename);
            if (hasInjectionAttempt) {
              console.warn(
                `[SECURITY WARNING] Prompt injection detected in PDF "${safeFilename}":`,
                detectedThreats,
              );
            }
            useMultimodalFile = false;
            extractedText = wrapDocumentForModel(sanitizedText, safeFilename);
            estimatedInputTokens = Math.ceil(sanitizedText.length / CHARS_PER_TOKEN);
          }
        } else if (isDocx) {
          if (!extracted.text.trim()) {
            return Response.json(
              {
                error:
                  "No readable text found in the document. Please ensure the file is a valid, non-corrupted document.",
              },
              { status: 422 },
            );
          }
          // Sanitize DOCX extracted text with DOMPurify + prompt injection defense
          // before sending to the model to prevent XSS and prompt injection via document content.
          const { sanitizedText, hasInjectionAttempt, detectedThreats } =
            sanitizeUntrustedDocumentText(extracted.text, safeFilename);
          if (hasInjectionAttempt) {
            console.warn(
              `[SECURITY WARNING] Prompt injection detected in DOCX "${safeFilename}":`,
              detectedThreats,
            );
          }
          useMultimodalFile = false;
          extractedText = wrapDocumentForModel(sanitizedText, safeFilename);
          estimatedInputTokens = Math.ceil(sanitizedText.length / CHARS_PER_TOKEN);
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
    }

    // 8. Token estimation and credit check
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

    // 9. Build messages with file contents for native multimodal processing or text review
    // Use the sanitized filename in the system prompt — not file.name — to prevent
    // prompt injection via a crafted filename like: `"><script>` or `ignore instructions`
    const systemPrompt = LEGAL_DOCUMENT_REVIEW_PROMPT(safeFilename);
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: useMultimodalFile
          ? [
              {
                type: "file",
                data: modelPayloadBuffer.toString("base64"),
                mediaType: modelPayloadMimeType,
              },
              {
                type: "text",
                // Sanitized filename used here too — never raw file.name
                text: `Please perform a complete legal review of the attached document ("${safeFilename}").`,
              },
            ]
          : [
              {
                type: "text",
                // extractedText already contains the securely sandboxed wrapDocumentForModel() output
                text: extractedText,
              },
            ],
      },
    ];

    // 10. Call Gemini for deep legal analysis using structured output
    const { output: reviewData, usage } = await generateText({
      model: vertex("gemini-3-flash-preview"),
      temperature: 0,
      instructions: systemPrompt,
      messages,
      output: Output.object({
        schema: legalReviewSchema,
      }),

      // providerOptions: {
      //     vertexai: {
      //       thinkingConfig: {
      //         thinkingConfig: {
      //           thinkingLevel: "medium",
      //         },
      //         mediaResolution:"MEDIA_RESOLUTION_LOW"
      //       } satisfies GoogleLanguageModelOptions,
      //     },
      //   },
    });

    // 11. Record token usage and deduct
    const actualTokens =
      (usage?.inputTokens ?? estimatedInputTokens) +
      (usage?.outputTokens ?? estimatedOutputTokens);

    await recordUsageAndDeduct({
      userId,
      type: "DOCUMENT_TRANSCRIPTION",
      tokens: actualTokens,
      // Use sanitized filename in the session ID — never raw file.name
      sessionId: `review-${safeFilename}-${Date.now()}`,
    });

    // 12. Return the structured review + metadata
    // Use safeFilename in the response — never echo back raw file.name which may contain XSS payloads
    return Response.json({
      success: true,
      review: {
        ...reviewData,
        fileName: safeFilename,
        tokensUsed: actualTokens,
        pageCount,
      },
    });
  } catch (error: unknown) {
    console.error("Review API error:", error);

    // Retries wrap the provider failure; classify the final attempt.
    const failure = RetryError.isInstance(error) ? error.lastError : error;
    const isApiError = APICallError.isInstance(failure);
    const isObjectError = NoObjectGeneratedError.isInstance(failure);
    const errorName =
      typeof failure === "object" && failure !== null && "name" in failure
        ? failure.name
        : undefined;
    // Only exact legacy codes on otherwise unstructured errors are a fallback.
    // Provider messages and generated document text must not override metadata.
    const legacyCode =
      !isApiError &&
      !isObjectError &&
      failure instanceof Error &&
      errorName === "Error"
        ? failure.message.trim()
        : "";

    if (
      (isApiError && failure.statusCode === 429) ||
      legacyCode === "RESOURCE_EXHAUSTED"
    ) {
      return Response.json(
        {
          error:
            "The AI review engine is currently at capacity or quota limits. Please try again in a moment.",
        },
        { status: 429 },
      );
    }

    if (
      (isApiError && failure.statusCode === 503) ||
      legacyCode === "UNAVAILABLE"
    ) {
      return Response.json(
        {
          error:
            "The AI review service is temporarily busy. Please try again shortly.",
        },
        { status: 503 },
      );
    }

    if (isObjectError && failure.finishReason === "content-filter") {
      return Response.json(
        {
          error:
            "The document content triggered AI safety filters and could not be reviewed.",
        },
        { status: 422 },
      );
    }

    if (
      errorName === "AbortError" ||
      errorName === "TimeoutError" ||
      legacyCode === "DEADLINE_EXCEEDED"
    ) {
      return Response.json(
        {
          error:
            "The review analysis timed out while processing this document. Please try a shorter document.",
        },
        { status: 504 },
      );
    }

    return Response.json(
      {
        error:
          "An unexpected server error occurred while analyzing the document. Please try again.",
      },
      { status: 500 },
    );
  }
}
