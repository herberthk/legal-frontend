"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";

// Hooks
import { useDocumentTranscribe } from "@/hooks/use-document-transcribe";

// Components
import { TranscribeHeader } from "@/components/user/transcribe/TranscribeHeader";
import { UploadZone } from "@/components/user/transcribe/UploadZone";
import { ProcessingStep } from "@/components/user/transcribe/ProcessingStep";
import { EditorView } from "@/components/user/transcribe/EditorView";
import { ReferenceModal } from "@/components/user/transcribe/ReferenceModal";

const Transcribe = () => {
  const {
    file,
    previewUrl,
    status,
    transcription,
    formatMode,
    error,
    setStatus,
    setTranscription,
    setFormatMode,
    handleDrop,
    processDocument,
    downloadPdf,
    reset,
  } = useDocumentTranscribe();

  const [showReferenceModal, setShowReferenceModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-indigo-50/5 dark:bg-[#050505] transition-colors duration-500">
      <TranscribeHeader status={status} hasFile={!!file} onReset={reset} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
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
                error={error}
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
    </div>
  );
};

export default Transcribe;
