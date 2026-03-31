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
    <div className="min-h-screen flex flex-col">
      <TranscribeHeader status={status} hasFile={!!file} onReset={reset} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {/* Upload Stage */}
          {status === "idle" && !file && (
            <UploadZone key="upload" onDrop={handleDrop} error={error} />
          )}

          {/* Processing/Options Stage */}
          {(status === "processing" || (status === "idle" && file)) && (
            <ProcessingStep
              key="processing"
              status={status}
              file={file}
              previewUrl={previewUrl}
              formatMode={formatMode}
              setFormatMode={setFormatMode}
              processDocument={processDocument}
              error={error}
            />
          )}

          {/* Editing/Previewing Stage */}
          {(status === "editing" || status === "previewing") && (
            <EditorView
              key="editor"
              status={status}
              setStatus={setStatus}
              transcription={transcription}
              setTranscription={setTranscription}
              previewUrl={previewUrl}
              file={file}
              onShowReference={() => setShowReferenceModal(true)}
              onDownload={downloadPdf}
            />
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
