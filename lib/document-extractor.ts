import { CHARS_PER_TOKEN } from "@/constants";

// Cache dynamic imports so they are only loaded once per cold start, reducing per-request latency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPdfParse: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedMammoth: any = null;

export interface ExtractedDocument {
  text: string;
  pageCount: number;
  estimatedTokens: number;
  isScannedPdf?: boolean;
}

/**
 * Extracts raw text, calculates page count, and estimates tokens for PDF and DOCX buffers.
 * Centralizes pdf-parse and mammoth loaders across chat, review, and transcribe.
 */
export async function extractDocumentText(
  buffer: Buffer,
  typeOrMime: "pdf" | "docx" | string,
): Promise<ExtractedDocument> {
  const normalized = typeOrMime.toLowerCase();
  const isPdf =
    normalized === "pdf" ||
    normalized === "application/pdf" ||
    normalized.endsWith(".pdf");

  const isDocx =
    normalized === "docx" ||
    normalized ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalized.endsWith(".docx");

  if (isPdf) {
    if (!cachedPdfParse) {
      const pdfParseModule = await import("pdf-parse");
      cachedPdfParse = pdfParseModule.default || pdfParseModule;
    }
    const parsed = await cachedPdfParse(buffer);
    const pdfText = parsed.text || "";
    const pageCount = parsed.numpages || 1;
    const isScannedPdf = pdfText.trim().length < 100;

    const estimatedTokens = isScannedPdf
      ? Math.max(500, pageCount * 1000)
      : Math.max(500, Math.ceil(pdfText.length / CHARS_PER_TOKEN));

    return {
      text: pdfText,
      pageCount,
      estimatedTokens,
      isScannedPdf,
    };
  }

  if (isDocx) {
    if (!cachedMammoth) {
      cachedMammoth = await import("mammoth");
    }
    const result = await cachedMammoth.extractRawText({ buffer });
    const docxText = result.value || "";
    const pageCount = Math.max(1, Math.ceil(docxText.length / 3000));
    const estimatedTokens = Math.ceil(docxText.length / CHARS_PER_TOKEN);

    return {
      text: docxText,
      pageCount,
      estimatedTokens,
    };
  }

  throw new Error(`Unsupported document type for text extraction: ${typeOrMime}`);
}
