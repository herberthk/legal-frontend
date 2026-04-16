/**
 * use-conversation-recorder.ts
 * ==============================
 * React hook that manages the lifecycle of the conversation-recorder-worker.js
 * persistent Web Worker and provides a clean API for the voice components.
 *
 * ── Responsibilities ──────────────────────────────────────────────────────────
 *  • Create the worker once (on mount) and keep it alive for the full session.
 *  • Route audio chunks to the worker via Transferable objects (zero-copy).
 *  • Trigger WAV assembly on demand (`finalizeRecording`).
 *  • Auto-download the finished WAV using an invisible <a> element.
 *  • Expose `isEncoding` so the UI can show a "Preparing download…" indicator.
 *  • Provide `cleanup()` to wipe IDB data and terminate the worker on unmount
 *    or when a session is abandoned without generating a WAV.
 *
 * ── Design decisions ──────────────────────────────────────────────────────────
 *  • Worker is created via `new Worker('/js/conversation-recorder-worker.js')`.
 *    It lives in /public/js so Next.js serves it as a static file — no bundler
 *    involvement, no module boundary issues, no dynamic import needed.
 *
 *  • Chunk callbacks (`addUserChunk`, `addAIChunk`) are stable references
 *    (useCallback with empty deps) so they can be passed to useGeminiLive's
 *    ref-based callback system without causing re-renders when audio arrives.
 *
 *  • We do NOT store any audio data in React state — only `isEncoding` and
 *    `isReady` booleans trigger re-renders. All audio data lives in the worker
 *    and IDB to keep the main thread memory profile minimal.
 *
 *  • The `sessionStartRef` (set at `startSession`) provides the time origin for
 *    all chunk timestamps. Using `Date.now() - sessionStartRef.current` gives
 *    each chunk an accurate millisecond offset from the start of the call.
 */

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseConversationRecorderReturn {
  /**
   * Call once when a session begins (on 'open' websocket status).
   * Sends 'init' to the worker and records the time origin for timestamps.
   */
  startSession: (sessionId: string) => void;

  /**
   * Feed a user-microphone PCM chunk to the recorder.
   * `buffer` is an Int16 ArrayBuffer at 16 kHz.
   * Ownership is TRANSFERRED to the worker (zero-copy); the buffer is
   * detached on the main thread after this call.
   */
  addUserChunk: (buffer: ArrayBuffer, timestamp: number) => void;

  /**
   * Feed a Gemini-AI PCM chunk to the recorder.
   * `buffer` is an Int16 ArrayBuffer at 24 kHz.
   * Ownership is TRANSFERRED to the worker (zero-copy); the buffer is
   * detached on the main thread after this call.
   */
  addAIChunk: (buffer: ArrayBuffer, timestamp: number) => void;

  /**
   * Trigger WAV finalization in the worker:
   *   1. Drain the write queue.
   *   2. Read + assemble all chunks from IDB.
   *   3. Encode as WAV.
   *   4. Auto-download with a timestamped filename.
   *
   * Sets `isEncoding = true` immediately; resets to false when the download
   * fires (or on error).
   */
  finalizeRecording: () => void;

  /**
   * True while the worker is assembling and encoding the WAV file.
   * Use this to show a "Preparing download…" spinner in the UI.
   */
  isEncoding: boolean;

  /**
   * Encoding/download progress 0–100. Only meaningful when isEncoding = true.
   */
  encodingProgress: number;

  /**
   * True once the worker has acknowledged 'init' and is ready to accept chunks.
   */
  isReady: boolean;

  /**
   * Clear all IDB data for the current session and terminate the worker.
   * Call this:
   *   a) When a session is abandoned without wanting a download.
   *   b) On component unmount (the useEffect cleanup handles this automatically).
   */
  cleanup: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationRecorder(): UseConversationRecorderReturn {
  // ── Worker ref ─────────────────────────────────────────────────────────────
  // We keep the Worker in a ref (not state) so React never re-renders when
  // the worker is created. The worker is persistent — created once on mount,
  // terminated on unmount.
  const workerRef = useRef<Worker | null>(null);

  // ── Session timing ─────────────────────────────────────────────────────────
  // The moment `startSession` is called becomes the time origin (t=0).
  // All chunk timestamps are computed as (Date.now() - sessionStartRef.current).
  // Storing in a ref (not state) avoids stale closure issues in the callbacks
  // that fire dozens of times per second.
  const sessionStartRef = useRef<number>(0);

  // ── UI state ───────────────────────────────────────────────────────────────
  // Only booleans/numbers live in React state — everything else is in refs.
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodingProgress, setEncodingProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // ─── Download helper ───────────────────────────────────────────────────────

  /**
   * Programmatically download a Blob as a WAV file.
   *
   * We use an invisible <a> with `download` attribute rather than
   * `window.open(url)` because:
   *   • `window.open` can be blocked by popup blockers.
   *   • The `download` attribute forces a save-as dialog even for audio MIME
   *     types, which is exactly what we want (not playing in the browser tab).
   *
   * The Object URL is revoked after 60 seconds to free the Blob's memory.
   * Revoking immediately (before click resolves) can break the download on
   * some browsers, hence the small delay.
   */
  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const now = new Date();
    // Filename: legal-session-YYYY-MM-DD-HH-MM.webm — human-readable, sortable.
    const filename = `legal-session-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}.webm`;

    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Revoke Blob URL after a short delay so the browser has time to start the
    // download before we free the underlying memory.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  // ─── Worker setup & message handler ───────────────────────────────────────
  // Created once on mount. The worker file is served from /public/js/ so it is
  // accessible at the /js/conversation-recorder-worker.js URL at runtime.
  useEffect(() => {
    // Guard: only create in a browser environment (not during SSR).
    if (typeof Worker === "undefined") return;

    const worker = new Worker(new URL("./recorder.worker.ts", import.meta.url));
    workerRef.current = worker;

    // ── Incoming messages from the worker ────────────────────────────────────
    worker.onmessage = (event: MessageEvent) => {
      const { type } = event.data;

      switch (type) {
        // Worker confirmed DB is open and it's ready to accept chunks.
        case "ready": {
          setIsReady(true);
          break;
        }

        // Worker is reporting encoding progress (0–100).
        case "progress": {
          setEncodingProgress(event.data.percent as number);
          break;
        }

        // Worker finished encoding — Blob is ready to download.
        case "webm_ready": {
          const blob: Blob = event.data.blob;
          triggerDownload(blob);
          setIsEncoding(false);
          setEncodingProgress(0);
          break;
        }

        // Worker ran into an error during write or finalize.
        case "error": {
          console.error(
            "[use-conversation-recorder] Worker error:",
            event.data.message,
          );
          setIsEncoding(false);
          setEncodingProgress(0);
          break;
        }

        default:
          break;
      }
    };

    // Log unhandled worker errors (e.g. syntax errors in the .js file).
    worker.onerror = (err) => {
      console.error("[use-conversation-recorder] Worker uncaught error:", err);
      setIsEncoding(false);
    };

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    // Send 'cleanup' first so the worker can delete IDB records before dying.
    // Then terminate so the OS reclaims the thread.
    return () => {
      worker.postMessage({ type: "cleanup" });
      // Give the worker a moment to start the async cleanup before we kill it.
      // 300 ms is more than enough for a simple IDB cursor-delete operation.
      setTimeout(() => worker.terminate(), 300);
      workerRef.current = null;
      setIsReady(false);
    };
  }, []); // Empty deps: run once on mount

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Initialize the worker for a new session.
   * Must be called before any addUserChunk / addAIChunk calls.
   */
  const startSession = useCallback((sessionId: string) => {
    if (!workerRef.current) {
      console.warn(
        "[use-conversation-recorder] Worker not ready — startSession ignored",
      );
      return;
    }
    // Record the wall-clock time origin for this session.
    sessionStartRef.current = Date.now();

    // Send session id to worker so it can associate IDB records correctly.
    workerRef.current.postMessage({ type: "init", sessionId });
  }, []); // stable — workerRef and sessionStartRef are refs

  /**
   * Forward a user microphone PCM chunk to the worker.
   *
   * TRANSFER semantics: after this call the `buffer` ArrayBuffer is detached
   * on the main thread (byteLength becomes 0). The caller must NOT read from
   * it after calling addUserChunk. In use-gemini-live.ts we call this AFTER
   * the Gemini SDK has already finished reading the buffer, so this is safe.
   *
   * Timestamp is pre-computed by the caller (Date.now() - sessionStart) to
   * avoid the overhead of reading sessionStartRef inside a closure that fires
   * ~25 times/second.
   */
  const addUserChunk = useCallback((buffer: ArrayBuffer, timestamp: number) => {
    if (!workerRef.current || buffer.byteLength === 0) return;
    workerRef.current.postMessage(
      { type: "user_chunk", buffer, timestamp },
      [buffer], // ← Transferable: zero-copy ownership transfer to worker
    );
  }, []);

  /**
   * Forward a Gemini AI PCM chunk to the worker.
   *
   * Same transfer semantics as addUserChunk. The caller (use-gemini-live.ts)
   * creates a separate copy of the AI audio buffer before transferring it here
   * because the player worklet also owns a copy of the original.
   */
  const addAIChunk = useCallback((buffer: ArrayBuffer, timestamp: number) => {
    if (!workerRef.current || buffer.byteLength === 0) return;
    workerRef.current.postMessage(
      { type: "ai_chunk", buffer, timestamp },
      [buffer], // ← Transferable
    );
  }, []);

  /**
   * Trigger WAV assembly in the worker and auto-download when ready.
   * Safe to call even if the session had zero audio chunks — the worker will
   * reply with { type: 'error' } and we reset isEncoding.
   */
  const finalizeRecording = useCallback(() => {
    if (!workerRef.current) {
      console.warn("[use-conversation-recorder] Worker not available");
      return;
    }
    setIsEncoding(true);
    setEncodingProgress(0);
    workerRef.current.postMessage({ type: "finalize" });
  }, []);

  /**
   * Clean up IDB records and terminate the worker.
   * Exposed so gemini-voice-connection can call it if the session is abandoned
   * (credit exhausted, user navigates away) without wanting a WAV download.
   */
  const cleanup = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: "cleanup" });
    setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
    }, 300);
    setIsReady(false);
    setIsEncoding(false);
    setEncodingProgress(0);
  }, []);

  return {
    startSession,
    addUserChunk,
    addAIChunk,
    finalizeRecording,
    isEncoding,
    encodingProgress,
    isReady,
    cleanup,
  };
}
