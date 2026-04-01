import { useState, useCallback, useMemo, Dispatch, SetStateAction } from "react";
import { GoogleGenAI } from "@google/genai";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument } from "@/components/editor/PDFDocument";

export type TranscribeStatus = "idle" | "processing" | "editing" | "previewing" | "error";
export type FormatMode = "professional" | "original";

interface UseDocumentTranscribeReturn {
  file: File | null;
  previewUrl: string | null;
  status: TranscribeStatus;
  transcription: string;
  formatMode: FormatMode;
  error: string | null;
  setFile: (file: File | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setStatus: (status: TranscribeStatus) => void;
  setTranscription: (text: string) => void;
  setFormatMode: (mode: FormatMode) => void;
  setError: (error: string | null) => void;
  handleDrop: (acceptedFiles: File[]) => void;
  processDocument: () => Promise<void>;
  downloadPdf: () => Promise<void>;
  reset: () => void;
  setShowPageNumbers: Dispatch<SetStateAction<boolean>>;
  setPageNumberPosition: Dispatch<
    SetStateAction<
      | "bottom-center"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "top-right"
      | "top-left"
    >
  >;
  setDocumentTitle: Dispatch<SetStateAction<string>>;
  setHeaderText: Dispatch<SetStateAction<string>>;
  setFooterText: Dispatch<SetStateAction<string>>;
  documentTitle: string;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  pageNumberPosition: string;
}

export const useDocumentTranscribe = (): UseDocumentTranscribeReturn => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [transcription, setTranscription] = useState("");
  const [formatMode, setFormatMode] = useState<FormatMode>("professional");
  const [error, setError] = useState<string | null>(null);
  const [showPageNumbers, setShowPageNumbers] = useState<boolean>(true);
  const [pageNumberPosition, setPageNumberPosition] = useState<
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left"
  >("bottom-center");
  const [documentTitle, setDocumentTitle] = useState("");
  const [headerText, setHeaderText] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("");

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStatus("idle");
      setTranscription("");
      setError(null);
    }
  }, []);

  const processDocument = useCallback(async () => {
    if (!file) return;

    setStatus("processing");
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API key is missing.");

      const ai = new GoogleGenAI({ apiKey });

      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");

      const basePrompt =
        "CRITICAL INSTRUCTION: Output ONLY the transcribed text. Do NOT include any conversational filler, introductory text, or labels like 'Here is the transcription...'. ";

      const prompt =
        formatMode === "professional"
          ? basePrompt +
            `Transcribe all text from this document, including both computer-typed and handwritten parts. If the document is a quotation, receipt, memo, or similar form, return the exact content including date, company name, location, receipt number, etc., where applicable. Add relevant formatting to make it look highly professional, well-structured, and clean (using paragraphs, bold, italic, etc.), but do NOT divert from the original document's meaning or facts. Do NOT add any sections, information, or content that is not present in the original document. Correct obvious spelling or grammatical errors in the handwritten parts only.`
          : basePrompt +
            `Transcribe all text from this document (both typed and handwritten) exactly as it appears. Maintain the original structure, line breaks, and formatting as closely as possible. Do not add any new headings or correct errors unless they are completely illegible.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash", // Assuming this is the desired stable version or keep as is
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type,
              },
            },
            { text: prompt },
          ],
        },
      });

      if (response.text) {
        setTranscription(response.text);

        // Extract title from first heading (markdown or simple HTML)
        const headingMatch =
          response.text.match(/^#\s+(.+)$/m) ||
          response.text.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (headingMatch && headingMatch[1]) {
          const cleanTitle = headingMatch[1].replace(/<[^>]*>?/gm, "").trim();
          setDocumentTitle(cleanTitle);
        } else {
          setDocumentTitle(
            file?.name?.replace(/\.[^/.]+$/, "") || "Untitled Document",
          );
        }

        setStatus("editing");
      } else {
        throw new Error("Failed to generate transcription.");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- Document Processing Error ---");
      console.error("Context:", {
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size,
        formatMode,
      });

      let userMessage =
        "An unexpected error occurred while processing the document. Please try again.";
      if (err?.message?.includes("API key")) {
        userMessage =
          "Configuration Error: Gemini API key is missing or invalid. Please check your AI Studio secrets.";
      } else if (
        err?.message?.includes("fetch") ||
        err?.message?.includes("network")
      ) {
        userMessage =
          "Network Error: Please check your internet connection and try again.";
      } else if (err?.message?.includes("quota") || err?.status === 429) {
        userMessage =
          "Quota Exceeded: The AI service is currently busy or out of quota. Please try again later.";
      } else if (err?.message) {
        userMessage = `Processing Error: ${err.message}`;
      }

      setError(userMessage);
      setStatus("idle");
    }
  }, [file, formatMode]);

  const downloadPdf = useCallback(async () => {
    try {
      const blob = await pdf(
        <PDFDocument
          content={transcription}
          filename={documentTitle || file?.name}
          headerText={headerText || undefined}
          footerText={footerText || undefined}
          showPageNumbers={showPageNumbers}
          pageNumberPosition={pageNumberPosition}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = (documentTitle || file?.name || "document")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      link.download = `scribe-${safeTitle}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- PDF Generation Error ---");
      setError(
        `Failed to generate PDF: ${err?.message || "Unknown rendering error"}. Please check if the transcription contains unsupported characters.`,
      );
    }
  }, [transcription, documentTitle, file, headerText, footerText, showPageNumbers, pageNumberPosition]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setTranscription("");
    setError(null);
  }, []);

  return useMemo(() => ({
    file,
    previewUrl,
    status,
    transcription,
    formatMode,
    error,
    setFile,
    setPreviewUrl,
    setStatus,
    setTranscription,
    setFormatMode,
    setError,
    handleDrop,
    processDocument,
    downloadPdf,
    reset,
    setHeaderText,
    setFooterText,
    setShowPageNumbers,
    setPageNumberPosition,
    setDocumentTitle,
    headerText,
    footerText,
    showPageNumbers,
    pageNumberPosition,
    documentTitle,
  }), [
    file,
    previewUrl,
    status,
    transcription,
    formatMode,
    error,
    handleDrop,
    processDocument,
    downloadPdf,
    reset,
    headerText,
    footerText,
    showPageNumbers,
    pageNumberPosition,
    documentTitle,
  ]);
};
