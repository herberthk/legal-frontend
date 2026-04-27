import {
  useState,
  useCallback,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument } from "@/components/editor/PDFDocument";
import { transcribeDocument } from "@/lib/actions";
import { useAuthStore } from "@/store";

export type TranscribeStatus =
  | "idle"
  | "processing"
  | "editing"
  | "previewing"
  | "error";
export type FormatMode = "professional" | "original";
export type TranscribeErrorType = "INSUFFICIENT_CREDITS" | "GENERAL";

interface UseDocumentTranscribeReturn {
  file: File | null;
  previewUrl: string | null;
  status: TranscribeStatus;
  transcription: string;
  formatMode: FormatMode;
  error: string | null;
  errorType: TranscribeErrorType | null;
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
  const [errorType, setErrorType] = useState<TranscribeErrorType | null>(null);
  const user = useAuthStore((state) => state.user);

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
      setErrorType(null);
    }
  }, []);

  const processDocument = useCallback(async () => {
    if (!file || !user?.id) return;

    setStatus("processing");
    setError(null);
    setErrorType(null);

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString("base64");

      const result = await transcribeDocument({
        base64Data,
        mimeType: file.type,
        formatMode,
        fileName: file.name,
      });

      if (result.success && result.text) {
        setTranscription(result.text);

        // Extract title from first heading
        const headingMatch =
          result.text.match(/^#\s+(.+)$/m) ||
          result.text.match(/<h1[^>]*>(.*?)<\/h1>/i);
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
        if (result.errorType === "INSUFFICIENT_CREDITS") {
          setError(
            result.error || "Insufficient tokens to process this document.",
          );
          setErrorType("INSUFFICIENT_CREDITS");
          setStatus("idle");
          return;
        }
        throw new Error(result.error || "Failed to generate transcription.");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- Document Processing Error ---", err);
      setErrorType("GENERAL");

      let userMessage =
        "An unexpected error occurred while processing the document. Please try again.";
      if (err?.message?.includes("API key")) {
        userMessage =
          "Configuration Error: Gemini API key is missing or invalid on the server.";
      } else if (err?.status === 429) {
        userMessage =
          "Quota Exceeded: The AI service is currently busy. Please try again later.";
      } else if (err?.message) {
        userMessage = `Processing Error: ${err.message}`;
      }

      setError(userMessage);
      setStatus("idle");
    }
  }, [file, formatMode, user?.id]);

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
  }, [
    transcription,
    documentTitle,
    file,
    headerText,
    footerText,
    showPageNumbers,
    pageNumberPosition,
  ]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setTranscription("");
    setError(null);
    setErrorType(null);
  }, []);

  return useMemo(
    () => ({
      file,
      previewUrl,
      status,
      transcription,
      formatMode,
      error,
      errorType,
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
    }),
    [
      file,
      previewUrl,
      status,
      transcription,
      formatMode,
      error,
      errorType,
      handleDrop,
      processDocument,
      downloadPdf,
      reset,
      headerText,
      footerText,
      showPageNumbers,
      pageNumberPosition,
      documentTitle,
    ],
  );
};
