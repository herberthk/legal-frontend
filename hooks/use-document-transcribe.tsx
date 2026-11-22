import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument } from "@/components/editor/PDFDocument";
import { getAppCheckToken } from "@/lib/firebaseAppCheck";
import { useAuthStore } from "@/store";
import { MAX_REVIEW_FILE_SIZE, MAX_REVIEW_FILE_SIZE_MB } from "@/constants";
import { ref, uploadBytes, deleteObject } from "firebase/storage";
import { storage } from "@/firebase/client";
import { STORAGE_PATHS } from "@/constants/buckets";
import posthog from "posthog-js";

interface TranscribeApiResponse {
  success?: boolean;
  text?: string;
  totalTokens?: number;
  error?: string;
}

const ACCEPTED_EXTENSIONS_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function resolveTranscribeMimeType(file: File): string | null {
  const rawType = (file.type || "").toLowerCase().trim();
  if (rawType === "application/pdf") return "application/pdf";
  if (rawType === "image/png") return "image/png";
  if (rawType === "image/jpeg" || rawType === "image/jpg") return "image/jpeg";
  if (rawType === "image/webp") return "image/webp";

  const ext = file.name.split(".").pop()?.toLowerCase().trim();
  if (ext && ACCEPTED_EXTENSIONS_MAP[ext]) {
    return ACCEPTED_EXTENSIONS_MAP[ext];
  }

  return null;
}

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
  tempStoragePath: string | null;
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
  tokensUsed: number;
}

export const useDocumentTranscribe = (): UseDocumentTranscribeReturn => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<TranscribeStatus>("idle");
  const [transcription, setTranscription] = useState("");
  const [formatMode, setFormatMode] = useState<FormatMode>("professional");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<TranscribeErrorType | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [tempStoragePath, setTempStoragePath] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.user)?.id;

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

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      const mime = resolveTranscribeMimeType(selectedFile);
      if (!mime) {
        setError("Only PDF, PNG, JPEG, and WebP files are supported for transcription.");
        setErrorType("GENERAL");
        return;
      }

      if (selectedFile.size > MAX_REVIEW_FILE_SIZE) {
        setError(
          `File exceeds ${MAX_REVIEW_FILE_SIZE_MB}MB limit. Your file is ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB.`,
        );
        setErrorType("GENERAL");
        return;
      }

      setPreviewUrl((prevUrl) => {
        if (prevUrl && prevUrl.startsWith("blob:")) {
          URL.revokeObjectURL(prevUrl);
        }
        return URL.createObjectURL(selectedFile);
      });
      setFile(selectedFile);
      setStatus("idle");
      setTranscription("");
      setError(null);
      setErrorType(null);
      setTokensUsed(0);
      setTempStoragePath(null);
    }
  }, []);

  const processDocument = useCallback(async () => {
    if (!file || !userId) return;

    const mimeType = resolveTranscribeMimeType(file);
    if (!mimeType) {
      setError("Only PDF, PNG, JPEG, and WebP files can be transcribed.");
      setErrorType("GENERAL");
      setStatus("idle");
      return;
    }

    if (file.size > MAX_REVIEW_FILE_SIZE) {
      setError(
        `File exceeds ${MAX_REVIEW_FILE_SIZE_MB}MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      );
      setErrorType("GENERAL");
      setStatus("idle");
      return;
    }

    setStatus("processing");
    setError(null);
    setErrorType(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 125_000);

    try {
      // 1. Direct browser-to-storage upload in temp directory.
      // This eliminates base64 memory overhead and completely bypasses
      // Vercel's 4.5 MB serverless body gateway limitation.
      const cleanFileName = (file.name || "document").replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      );
      const tempPath = `${STORAGE_PATHS.TRANSCRIPTIONS_TEMP}/${userId}/${Date.now()}_${cleanFileName}`;
      const storageRef = ref(storage, tempPath);
      await uploadBytes(storageRef, file, { contentType: mimeType });
      setTempStoragePath(tempPath);

      // 2. Obtain App Check token
      const appCheckToken = await getAppCheckToken();

      // 3. Dispatch transcription request with tiny JSON metadata (< 1 KB)
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(appCheckToken ? { "x-firebase-appcheck": appCheckToken } : {}),
        },
        body: JSON.stringify({
          storagePath: tempPath,
          mimeType,
          formatMode,
          fileName: file.name,
        }),
        signal: controller.signal,
      });

      let result: TranscribeApiResponse | null = null;
      try {
        result = (await response.json()) as TranscribeApiResponse;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        if (response.status === 402) {
          setError(
            result?.error || "Insufficient tokens to process this document.",
          );
          setErrorType("INSUFFICIENT_CREDITS");
          setStatus("idle");
          return;
        }
        if (response.status === 422) {
          setError(
            result?.error ||
              "The uploaded document could not be decoded. Please ensure it is a valid, uncorrupted image or PDF.",
          );
          setErrorType("GENERAL");
          setStatus("idle");
          return;
        }
        if (response.status === 413) {
          setError("File payload is too large. Please use a file under 10 MB.");
          setErrorType("GENERAL");
          setStatus("idle");
          return;
        }
        if (response.status === 504) {
          setError("Transcription timed out. Please try again with a smaller document.");
          setErrorType("GENERAL");
          setStatus("idle");
          return;
        }
        throw new Error(result?.error || "Failed to generate transcription.");
      }

      const { text, totalTokens } = result;

      if (!text) {
        throw new Error("No transcription text returned from the server.");
      }

      setTranscription(text);
      setTokensUsed(totalTokens || 0);

      // Extract title from first heading
      const headingMatch =
        text.match(/^#\s+(.+)$/m) ||
        text.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (headingMatch && headingMatch[1]) {
        const cleanTitle = headingMatch[1].replace(/<[^>]*>?/gm, "").trim();
        setDocumentTitle(cleanTitle);
      } else {
        setDocumentTitle(
          file?.name?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        );
      }

      setStatus("editing");
      posthog.capture("document_transcription_completed", {
        document_type: mimeType === "application/pdf" ? "pdf" : "image",
        format_mode: formatMode,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Transcription timed out. Please try again with a smaller document.");
        setStatus("idle");
        return;
      }

      console.error("--- Document Processing Error ---", err);
      setErrorType("GENERAL");

      let userMessage =
        "An unexpected error occurred while processing the document. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("API key")) {
          userMessage =
            "Configuration Error: Gemini API key is missing or invalid on the server.";
        } else if (err.message.includes("429")) {
          userMessage =
            "Quota Exceeded: The AI service is currently busy. Please try again later.";
        } else if (err.message) {
          userMessage = `Processing Error: ${err.message}`;
        }
      }

      setError(userMessage);
      setStatus("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [file, formatMode, userId]);

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
    setPreviewUrl((prevUrl) => {
      if (prevUrl && prevUrl.startsWith("blob:")) {
        URL.revokeObjectURL(prevUrl);
      }
      return null;
    });

    if (tempStoragePath) {
      deleteObject(ref(storage, tempStoragePath)).catch(() => {});
      setTempStoragePath(null);
    }

    setFile(null);
    setStatus("idle");
    setTranscription("");
    setError(null);
    setErrorType(null);
    setTokensUsed(0);
  }, [tempStoragePath]);

  return useMemo(
    () => ({
      file,
      previewUrl,
      status,
      transcription,
      formatMode,
      error,
      errorType,
      tempStoragePath,
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
      tokensUsed,
    }),
    [
      file,
      previewUrl,
      status,
      transcription,
      formatMode,
      error,
      errorType,
      tempStoragePath,
      handleDrop,
      processDocument,
      downloadPdf,
      reset,
      headerText,
      footerText,
      showPageNumbers,
      pageNumberPosition,
      documentTitle,
      tokensUsed,
    ],
  );
};
