/**
 * use-conversation-recorder.ts
 * ==============================
 * React hook that manages the lifecycle of the conversation-recorder-worker.js
 * persistent Web Worker and provides a clean API for the voice components.
 *
 * ── Responsibilities ──────────────────────────────────────────────────────────
 *  • Create the worker once (on mount) and keep it alive for the full session.
 *  • Route audio chunks to the worker via Transferable objects (zero-copy).
 *  • Trigger WebM assembly on demand (`finalizeRecording`).
 *  • Expose `isEncoding` so the UI can show a "Preparing download…" indicator.
 *  • Provide `cleanup(sessionId)` to release stored PCM once the encoded audio
 *    has been uploaded, or when a session is discarded on purpose.
 *
 * ── Durability ────────────────────────────────────────────────────────────────
 *  Stored chunks outlive both the worker and this hook. Unmount terminates the
 *  worker but never deletes data: navigating away is precisely when a
 *  finalization may still be in flight, and IDB then holds the only copy of the
 *  recording. Reclaiming is the worker's job — it prunes sessions older than its
 *  retention window each time a new session initialises.
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
   * Trigger WebM finalization in the worker:
   *   1. Drain the write queue.
   *   2. Read + assemble all chunks from IDB.
   *   3. Encode as WebM/Opus.
   *   4. Return the assembled Blob.
   *
   * Sets `isEncoding = true` immediately; resets to false when done.
   * Chunks are NOT deleted after encoding — call `cleanup(sessionId)` once the
   * blob has been uploaded.
   */
  finalizeRecording: () => Promise<Blob>;

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
   * Release the stored PCM for a session. Call this only once the audio is
   * safely uploaded (or the session is being discarded on purpose) — until
   * then IDB holds the only copy. The worker stays alive for the next call.
   * Omit `sessionId` to release the worker's current session.
   */
  cleanup: (sessionId?: string) => void;
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

  // Reference to the promise resolve function for finalizeRecording
  const finalizeResolveRef = useRef<((blob: Blob) => void) | null>(null);
  const finalizeRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  // ─── Worker setup & message handler ───────────────────────────────────────
  // Created once on mount. The worker file is served from /public/js/ so it is
  // accessible at the /js/conversation-recorder-worker.js URL at runtime.
  useEffect(() => {
    // Guard: only create in a browser environment (not during SSR).
    if (typeof Worker === "undefined") return;

    const worker = new Worker("/js/recorder-worker.js");
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

        // Worker finished encoding — Blob is ready.
        case "webm_ready": {
          const blob: Blob = event.data.blob;
          if (finalizeResolveRef.current) {
            finalizeResolveRef.current(blob);
            finalizeResolveRef.current = null;
            finalizeRejectRef.current = null;
          }
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
          if (finalizeRejectRef.current) {
            finalizeRejectRef.current(new Error(event.data.message));
            finalizeResolveRef.current = null;
            finalizeRejectRef.current = null;
          }
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
      console.log("[use-conversation-recorder] Worker uncaught error:", err);
      setIsEncoding(false);
    };

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    // Terminate only — do NOT wipe IDB here. Unmount happens while navigating
    // away, which is exactly when a finalization may still be in flight; the
    // stored PCM is then the only copy of the recording. The worker prunes
    // sessions by age on its next init instead.
    return () => {
      worker.terminate();
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
   * Trigger WAV assembly in the worker and return the Blob.
   */
  const finalizeRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        console.warn("[use-conversation-recorder] Worker not available");
        reject(new Error("Worker not available"));
        return;
      }
      setIsEncoding(true);
      setEncodingProgress(0);
      finalizeResolveRef.current = resolve;
      finalizeRejectRef.current = reject;
      workerRef.current.postMessage({ type: "finalize" });
    });
  }, []);

  /**
   * Release the stored PCM for a session once it is no longer needed —
   * i.e. after the encoded audio has been uploaded, or when a session is
   * abandoned on purpose.
   *
   * The worker is deliberately left running: the component reuses it for the
   * next call, and terminating it here would race any in-flight finalize.
   * Omit `sessionId` to release the worker's current session.
   */
  const cleanup = useCallback((sessionId?: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: "cleanup", sessionId });
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
