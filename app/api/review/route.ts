import { generateText, Output, ModelMessage  } from "ai";
import { z } from 'zod';
import { getAuthenticatedUserId } from "@/lib/actions/auth";
import { checkUserCanSend, recordUsageAndDeduct } from "@/lib/actions/usage";
import {
  LEGAL_DOCUMENT_REVIEW_PROMPT,
  CHARS_PER_TOKEN,
  MAX_REVIEW_FILE_SIZE,
  COST_PER_THOUSAND_TOKENS_IN_CENTS,
} from "@/constants";
import { vertex } from "@/lib/actions/vertex";

export const maxDuration = 120;

// Cache dynamic imports so they are only loaded once per cold start, reducing per-request latency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPdfParse: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedMammoth: any = null;

// Static schema declaration to avoid recreating validation objects on every request
const legalReviewSchema = z.object({
  documentType: z.string().describe("The type of legal document (e.g., Lease Agreement, NDA, Employment Contract)"),
  summary: z.string().describe("A concise summary of the document"),
  overallScore: z.number().min(0).max(100).describe("Overall fairness/risk score for the document (0-100)"),
  highlights: z.array(z.string()).describe("Key highlights of the document"),
  scoreBreakdown: z.array(
    z.object({
      category: z.string().describe("The category of the score (e.g., Fairness, Clarity, Completeness)"),
      score: z.number().min(0).max(100).describe("The score for the category (0-100)"),
    }),
  ),
  keyClauses: z.array(
    z.object({
      title: z.string().describe("The title of the key clause"),
      content: z.string().describe("The content of the key clause"),
      assessment: z.string().describe("The assessment of the key clause"),
      riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("The risk level of the key clause (LOW, MEDIUM, HIGH)"),
    }),
  ),
  risks: z.array(
    z.object({
      title: z.string().describe("The title of the risk"),
      description: z.string().describe("The description of the risk"),
      severity: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("The severity of the risk (LOW, MEDIUM, HIGH)"),
      clause: z.string().optional().describe("The clause associated with the risk"),
      recommendation: z.string().describe("The recommendation for the risk"),
    }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string().describe("The title of the recommendation"),
      description: z.string().describe("The description of the recommendation"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("The priority of the recommendation (LOW, MEDIUM, HIGH)"),
    }),
  ),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

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
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isDocx && !isImage) {
      return Response.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, or image file (PNG/JPG/WEBP)." },
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

    if (isImage) {
      estimatedInputTokens = 1000;
      pageCount = 1;
      useMultimodalFile = true;
    } else {
      try {
        if (isPdf) {
          if (!cachedPdfParse) {
            const pdfParseModule = await import("pdf-parse");
            cachedPdfParse = pdfParseModule.default || pdfParseModule;
          }
          const parsed = await cachedPdfParse(buffer);
          const pdfText = parsed.text || "";
          pageCount = parsed.numpages || 1;
          
          if (pdfText.trim().length < 100) {
            // Scanned PDF: Fall back to native visual file upload
            useMultimodalFile = true;
            estimatedInputTokens = pageCount * 1000;
          } else {
            // Text-based PDF: Send extracted text for consistency & cost efficiency
            useMultimodalFile = false;
            extractedText = pdfText;
            estimatedInputTokens = Math.ceil(pdfText.length / CHARS_PER_TOKEN);
          }
        } else if (isDocx) {
          if (!cachedMammoth) {
            cachedMammoth = await import("mammoth");
          }
          const result = await cachedMammoth.extractRawText({ buffer });
          const docxText = result.value || "";
          if (!docxText.trim()) {
            return Response.json(
              { error: "No readable text found in the document. Please ensure the file is a valid, non-corrupted document." },
              { status: 422 },
            );
          }
          pageCount = Math.max(1, Math.ceil(docxText.length / 3000));
          useMultimodalFile = false;
          extractedText = docxText;
          estimatedInputTokens = Math.ceil(docxText.length / CHARS_PER_TOKEN);
        }
      } catch (error) {
        console.error("Document parsing error:", error);
        return Response.json(
          { error: "Failed to read document. Please ensure the file is valid and non-encrypted." },
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
    const systemPrompt = LEGAL_DOCUMENT_REVIEW_PROMPT(file.name);
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: useMultimodalFile
          ? [
              {
                type: "file",
                data: buffer.toString("base64"),
                mediaType: isPdf ? "application/pdf" : file.type,
              },
              {
                type: "text",
                text: "Please perform a complete legal review of the attached document.",
              },
            ]
          : [
              {
                type: "text",
                text: `DOCUMENT TEXT:\n\n${extractedText}`,
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
