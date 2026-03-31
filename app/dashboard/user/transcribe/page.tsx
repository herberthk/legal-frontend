"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileUp,
  FileText,
  Download,
  Edit3,
  ArrowRight,
  FileImage,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { GoogleGenAI } from "@google/genai";
import { pdf } from "@react-pdf/renderer";

import { PDFDocument } from "@/components/editor/PDFDocument";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import Image from "next/image";

// export const metadata: Metadata = {
//   title: "Scribe - Handwritten Document Digitizer",
//   description:
//     "Convert handwritten legal and financial documents into well-formatted PDFs.",
// };

export default function ScribeApp() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "processing" | "editing" | "previewing"
  >("idle");
  const [transcription, setTranscription] = useState("");
  const [formatMode, setFormatMode] = useState<"professional" | "original">(
    "professional",
  );
  const [error, setError] = useState<string | null>(null);
  const [showReferenceModal, setShowReferenceModal] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStatus("idle");
      setTranscription("");
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const processDocument = async () => {
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
        model: "gemini-2.5-flash",
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
        setStatus("editing");
      } else {
        throw new Error("Failed to generate transcription.");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- Document Processing Error ---");
      console.error("Error Name:", err?.name);
      console.error("Error Message:", err?.message);
      console.error("Stack Trace:", err?.stack);
      console.error("Context:", {
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size,
        formatMode,
      });
      console.error("---------------------------------");

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
  };

  const downloadPdf = async () => {
    try {
      const blob = await pdf(
        <PDFDocument content={transcription} filename={file?.name} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scribe-document-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("--- PDF Generation Error ---");
      console.error("Error Name:", err?.name);
      console.error("Error Message:", err?.message);
      console.error("Stack Trace:", err?.stack);
      console.error("Context:", {
        transcriptionLength: transcription?.length,
        filename: file?.name,
      });
      console.error("----------------------------");

      setError(
        `Failed to generate PDF: ${err?.message || "Unknown rendering error"}. Please check if the transcription contains unsupported characters.`,
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a1a1a]/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#f5f2ed]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                Scribe
              </h1>
              <p className="text-xs font-mono uppercase tracking-widest text-[#1a1a1a]/60">
                Document Digitizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {(status !== "idle" || file) && (
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setStatus("idle");
                  setTranscription("");
                }}
                className="text-sm font-medium hover:text-[#1a1a1a]/70 transition-colors px-4 py-2 rounded-full hover:bg-[#1a1a1a]/5"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {status === "idle" && !file && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-12">
                <h2 className="font-serif text-5xl mb-4 font-light tracking-tight">
                  Transform handwriting into <br />
                  <span className="italic font-medium">
                    professional documents.
                  </span>
                </h2>
                <p className="text-lg text-[#1a1a1a]/60 max-w-xl mx-auto">
                  Upload your handwritten legal notes, financial ledgers, or
                  meeting minutes. Scribe will transcribe and format them into
                  pristine PDFs.
                </p>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-500 shadow-sm hover:shadow-xl ${
                  isDragActive
                    ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]"
                    : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white/50 hover:bg-white"
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-20 h-20 mx-auto rounded-full bg-[#f5f2ed] border border-[#1a1a1a]/10 flex items-center justify-center mb-6 shadow-inner">
                  <FileUp className="w-8 h-8 text-[#1a1a1a]/60" />
                </div>
                <h3 className="text-xl font-medium mb-2">
                  Drag & drop your document
                </h3>
                <p className="text-[#1a1a1a]/60 mb-6">
                  Supports JPG, PNG, WEBP, and PDF up to 10MB
                </p>
                <button className="px-8 py-3 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5">
                  Select File
                </button>
              </div>

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-center">
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {(status === "processing" || (status === "idle" && file)) && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-3xl p-8 shadow-2xl border border-[#1a1a1a]/10 overflow-hidden relative">
                <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
                  <div className="w-full md:w-1/2 aspect-3/4 rounded-2xl overflow-hidden bg-[#f5f2ed] border border-[#1a1a1a]/10 relative shadow-inner">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Document preview"
                        className={`w-full h-full object-cover transition-all duration-700 ${status === "processing" ? "scale-105 blur-[2px] brightness-75" : ""}`}
                      />
                    )}

                    {/* Scanning Animation */}
                    {status === "processing" && (
                      <>
                        <motion.div
                          className="absolute left-0 right-0 h-32 bg-linear-to-b from-transparent to-[#1a1a1a]/40 border-b-2 border-[#1a1a1a] z-20"
                          animate={{ top: ["-20%", "100%"] }}
                          transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                        <div className="absolute inset-0 bg-[#1a1a1a]/10 mix-blend-overlay z-10" />
                      </>
                    )}

                    <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent z-10" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-white z-20">
                      <FileImage className="w-4 h-4 drop-shadow-md" />
                      <span className="text-sm font-medium truncate drop-shadow-md">
                        {file?.name}
                      </span>
                    </div>
                  </div>

                  <div className="w-full md:w-1/2 flex flex-col h-full justify-center">
                    {status === "processing" ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center text-center space-y-8 py-12"
                      >
                        <div className="relative w-24 h-24 flex items-center justify-center">
                          <motion.div className="absolute inset-0 border-4 border-[#1a1a1a]/10 rounded-full" />
                          <motion.div
                            className="absolute inset-0 border-4 border-[#1a1a1a] rounded-full border-t-transparent border-l-transparent"
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          />
                          <motion.div
                            animate={{
                              scale: [0.9, 1.1, 0.9],
                              opacity: [0.7, 1, 0.7],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            <FileText className="w-8 h-8 text-[#1a1a1a]" />
                          </motion.div>
                        </div>
                        <div>
                          <h3 className="font-serif text-3xl font-bold mb-3 tracking-tight">
                            Digitizing...
                          </h3>
                          <p className="text-[#1a1a1a]/60 text-lg">
                            Extracting text and applying professional formatting
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <h3 className="font-serif text-3xl mb-6 tracking-tight">
                          Processing Options
                        </h3>

                        <div className="space-y-4 mb-8">
                          <label
                            className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formatMode === "professional" ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]" : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white"}`}
                          >
                            <input
                              type="radio"
                              name="format"
                              value="professional"
                              checked={formatMode === "professional"}
                              onChange={() => setFormatMode("professional")}
                              className="mt-1.5 w-4 h-4 accent-[#1a1a1a]"
                            />
                            <div>
                              <p className="font-medium mb-1 text-lg">
                                Professional Format
                              </p>
                              <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">
                                Restructures text into a clean, formal layout
                                with headings. Ideal for legal, financial, or
                                business documents.
                              </p>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${formatMode === "original" ? "border-[#1a1a1a] bg-[#1a1a1a]/5 scale-[1.02]" : "border-[#1a1a1a]/20 hover:border-[#1a1a1a]/40 bg-white"}`}
                          >
                            <input
                              type="radio"
                              name="format"
                              value="original"
                              checked={formatMode === "original"}
                              onChange={() => setFormatMode("original")}
                              className="mt-1.5 w-4 h-4 accent-[#1a1a1a]"
                            />
                            <div>
                              <p className="font-medium mb-1 text-lg">
                                Maintain Original
                              </p>
                              <p className="text-sm text-[#1a1a1a]/60 leading-relaxed">
                                Transcribes exactly as written, preserving line
                                breaks and original structure without adding new
                                formatting.
                              </p>
                            </div>
                          </label>
                        </div>

                        <button
                          onClick={processDocument}
                          className="w-full py-4 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                          Start Digitization
                          <ArrowRight className="w-5 h-5" />
                        </button>

                        {error && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm shadow-sm"
                          >
                            {error}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(status === "editing" || status === "previewing") && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-12rem)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 bg-white rounded-full p-1.5 border border-[#1a1a1a]/10 shadow-sm">
                  <button
                    onClick={() => setStatus("editing")}
                    className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${status === "editing" ? "bg-[#1a1a1a] text-[#f5f2ed] shadow-md scale-[1.02]" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </div>
                  </button>
                  <button
                    onClick={() => setStatus("previewing")}
                    className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${status === "previewing" ? "bg-[#1a1a1a] text-[#f5f2ed] shadow-md scale-[1.02]" : "text-[#1a1a1a]/60 hover:text-[#1a1a1a] hover:bg-[#1a1a1a]/5"}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Preview
                    </div>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {status === "previewing" && (
                    <>
                      <button
                        onClick={() => setShowReferenceModal(true)}
                        className="px-6 py-2.5 rounded-full bg-white border border-[#1a1a1a]/10 text-[#1a1a1a] font-medium hover:bg-[#f5f2ed] transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                      >
                        <FileImage className="w-4 h-4" />
                        View Original
                      </button>
                      <button
                        onClick={downloadPdf}
                        className="px-6 py-2.5 rounded-full bg-[#1a1a1a] text-[#f5f2ed] font-medium hover:bg-[#1a1a1a]/90 transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-xl border border-[#1a1a1a]/10 h-full overflow-hidden flex transition-shadow duration-500 hover:shadow-2xl">
                {/* Left side: Original Document Reference */}
                {previewUrl && status === "editing" && (
                  <div className="w-1/3 border-r border-[#1a1a1a]/10 bg-[#f5f2ed]/50 p-6 overflow-y-auto flex flex-col">
                    <div className="sticky top-0 pb-4 mb-4 border-b border-[#1a1a1a]/10 flex items-center gap-2 text-[#1a1a1a]/60 bg-[#f5f2ed]/50 backdrop-blur-sm z-10">
                      <FileImage className="w-4 h-4" />
                      <span className="text-xs font-mono uppercase tracking-wider">
                        Original Reference
                      </span>
                    </div>
                    {file?.type === "application/pdf" ? (
                      <iframe
                        src={`${previewUrl}#toolbar=0`}
                        className="w-full flex-1 min-h-[500px] rounded-xl border border-[#1a1a1a]/10 shadow-md bg-white transition-shadow hover:shadow-lg"
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Reference"
                        className="w-full rounded-xl border border-[#1a1a1a]/10 shadow-md transition-shadow hover:shadow-lg"
                      />
                    )}
                  </div>
                )}

                {/* Right side: Editor or Preview */}
                <div
                  className={`flex-1 flex flex-col overflow-hidden bg-[#f5f2ed]/30 items-center overflow-y-auto ${status === "previewing" ? "p-8" : "p-8"}`}
                >
                  {status === "editing" ? (
                    <TiptapEditor
                      content={transcription}
                      onChange={setTranscription}
                    />
                  ) : (
                    <TiptapEditor
                      content={transcription}
                      onChange={setTranscription}
                      readOnly={true}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Reference Modal */}
      <AnimatePresence>
        {showReferenceModal && previewUrl && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReferenceModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-[5%] bottom-[5%] left-[5%] right-[5%] md:left-[10%] md:right-[10%] bg-white rounded-3xl shadow-2xl border border-[#1a1a1a]/10 z-50 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]/10 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-2 text-[#1a1a1a]">
                  <FileImage className="w-5 h-5" />
                  <h3 className="font-serif text-xl font-bold tracking-tight">
                    Original Reference
                  </h3>
                </div>
                <button
                  onClick={() => setShowReferenceModal(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1a1a1a]/5 transition-colors text-[#1a1a1a]/60 hover:text-[#1a1a1a]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8 bg-[#f5f2ed]/50 flex justify-center items-start">
                {file?.type === "application/pdf" ? (
                  <iframe
                    src={`${previewUrl}#toolbar=0`}
                    className="w-full max-w-5xl h-full min-h-[700px] rounded-2xl border border-[#1a1a1a]/10 shadow-xl bg-white"
                  />
                ) : (
                  <div className="w-full max-w-5xl h-auto rounded-2xl border border-[#1a1a1a]/10 shadow-xl relative">
                    <img
                      src={previewUrl}
                      alt="Reference"
                      className="w-full max-w-5xl h-auto rounded-2xl border border-[#1a1a1a]/10 shadow-xl"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
