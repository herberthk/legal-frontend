"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";

// Hooks
import { useDocumentTranscribe } from "@/hooks/use-document-transcribe";

// Components
import { UploadZone } from "@/components/user/transcribe/UploadZone";
import { ProcessingStep } from "@/components/user/transcribe/ProcessingStep";
import { EditorView } from "@/components/user/transcribe/EditorView";
import { ReferenceModal } from "@/components/user/transcribe/ReferenceModal";
import { PdfSettingsModal } from "@/components/user/transcribe/PdfSettingsModal";

import { ArrowLeft } from "lucide-react";
import { storage } from "@/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { saveTranscriptionRecord } from "@/lib/actions/transcribe";
import { toast } from "sonner";

interface TranscribeProps {
  onClose?: () => void;
  initialRecord?: TranscriptionRecord | null;
}

const Transcribe = ({ onClose, initialRecord }: TranscribeProps) => {
  const {
    file,
    previewUrl,
    status,
    transcription,
    formatMode,
    error,
    errorType,
    setStatus,
    setTranscription,
    setFormatMode,
    setPreviewUrl,
    handleDrop,
    processDocument,
    downloadPdf,
    reset,
    setShowPageNumbers,
    setPageNumberPosition,
    setDocumentTitle,
    setHeaderText,
    setFooterText,
    headerText,
    footerText,
    showPageNumbers,
    pageNumberPosition,
    documentTitle,
  } = useDocumentTranscribe();

  useEffect(() => {
    if (initialRecord) {
      setTranscription(initialRecord.transcribedText);
      setDocumentTitle(initialRecord.title);
      setFormatMode(initialRecord.formatMode);
      setStatus("editing");
      if (initialRecord.fileUrl) {
        setPreviewUrl(initialRecord.fileUrl);
      }
    }
  }, [
    initialRecord,
    setTranscription,
    setDocumentTitle,
    setFormatMode,
    setStatus,
    setPreviewUrl,
  ]);

  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!transcription) {
      toast.error("No transcription to save.");
      return;
    }

    setIsSaving(true);
    let fileUrl: string | undefined = undefined;

    try {
      if (file) {
        const storageRef = ref(
          storage,
          `transcriptions/${Date.now()}_${file.name}`,
        );
        const snapshot = await uploadBytes(storageRef, file);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      const res = await saveTranscriptionRecord({
        title: documentTitle || "Untitled Document",
        fileName: file?.name || "untitled.pdf",
        fileUrl,
        transcribedText: transcription,
        formatMode,
      });

      if (res.success) {
        toast.success("Transcription saved successfully!");
        if (onClose) onClose();
      } else {
        toast.error("Failed to save transcription", { description: res.error });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      toast.error("An error occurred while saving.", {
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-indigo-50/5 dark:bg-slate-900 transition-colors duration-500">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-2 mb-6 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-xl font-medium shadow-sm transition-colors border border-slate-100 dark:border-slate-700 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to History
          </button>
        )}
        <AnimatePresence mode="wait">
          {/* Upload Stage */}
          {status === "idle" && !file && (
            <UploadZone key="upload" onDrop={handleDrop} error={error} />
          )}

          {/* Processing/Options Stage */}
          {(status === "processing" || (status === "idle" && file)) && (
            <div
              key="processing-container"
              className="h-full flex items-center justify-center"
            >
              <ProcessingStep
                status={status}
                file={file}
                previewUrl={previewUrl}
                formatMode={formatMode}
                setFormatMode={setFormatMode}
                processDocument={processDocument}
                onReset={reset}
                error={error}
                errorType={errorType}
              />
            </div>
          )}

          {/* Editing/Previewing Stage */}
          {(status === "editing" || status === "previewing") && (
            <div key="editor-container" className="h-full min-h-[700px]">
              <EditorView
                status={status}
                setStatus={setStatus}
                transcription={transcription}
                setTranscription={setTranscription}
                previewUrl={previewUrl}
                file={file}
                onShowReference={() => setShowReferenceModal(true)}
                onDownload={downloadPdf}
                onReset={reset}
                setShowSettingsModal={setShowSettingsModal}
                onSave={handleSave}
                isSaving={isSaving}
              />
            </div>
          )}
        </AnimatePresence>
      </main>

      <ReferenceModal
        isOpen={showReferenceModal}
        onClose={() => setShowReferenceModal(false)}
        previewUrl={previewUrl}
        file={file}
      />

      {/* Settings modal */}
      {showSettingsModal && (
        <PdfSettingsModal
          setShowSettingsModal={setShowSettingsModal}
          documentTitle={documentTitle}
          setDocumentTitle={setDocumentTitle}
          headerText={headerText}
          setHeaderText={setHeaderText}
          footerText={footerText}
          setFooterText={setFooterText}
          showPageNumbers={showPageNumbers}
          setShowPageNumbers={setShowPageNumbers}
          pageNumberPosition={pageNumberPosition}
          setPageNumberPosition={setPageNumberPosition}
        />
      )}
    </div>
  );
};

export default Transcribe;
