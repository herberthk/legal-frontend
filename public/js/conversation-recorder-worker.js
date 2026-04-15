/**
 * conversation-recorder-worker.js
 * ================================
 * Persistent Web Worker responsible for:
 *   1. Ingesting audio chunks (user mic + Gemini AI) into IndexedDB via a
 *      serialized write queue — keeping the main thread 100% free of disk I/O.
 *   2. On "finalize": reading all session chunks from IDB, resampling AI audio
 *      from 24 kHz → 16 kHz, assembling them into a single chronological
 *      timeline (with silence in gaps between turns), and encoding a WAV blob.
 *   3. Posting the finished WAV Blob back to the main thread for download.
 *   4. Cleaning up IndexedDB records after the session is done.
 *
 * ── Why a Web Worker? ─────────────────────────────────────────────────────────
 * WAV encoding for a 1-hour session touches ~57 MB of Int16 sample data.
 * Running that on the main thread would freeze the UI for seconds. The worker
 * runs on a separate OS thread so the React UI stays perfectly responsive.
 *
 * ── Why IndexedDB (not in-memory arrays)? ────────────────────────────────────
 * A 1-hour stereo recording can easily exceed 100 MB.  Keeping that in a JS
 * array would trigger GC pauses and risk an OOM crash on low-memory devices.
 * IDB gives us durable, off-heap storage. Workers can access IDB directly —
 * the main thread never touches the storage layer at all.
 *
 * ── Why a serial write queue? ────────────────────────────────────────────────
 * Audio arrives at ~25 chunks/second. If we open a new IDB transaction per
 * chunk without ordering them, multiple concurrent transactions can conflict
 * on the same object store and throw "TransactionInactiveError" or silently
 * drop data. Chaining each write via a resolved-promise queue serializes them
 * safely while still being non-blocking (each write resolves before the next
 * begins, but none block the worker's event loop between chunks).
 *
 * ── Message protocol (main thread → worker) ──────────────────────────────────
 *   { type: 'init',       sessionId: string }
 *   { type: 'user_chunk', buffer: ArrayBuffer, timestamp: number }  ← Int16 @16kHz, transferable
 *   { type: 'ai_chunk',   buffer: ArrayBuffer, timestamp: number }  ← Int16 @24kHz, transferable
 *   { type: 'finalize' }
 *   { type: 'cleanup' }
 *
 * ── Message protocol (worker → main thread) ───────────────────────────────────
 *   { type: 'wav_ready',  blob: Blob }
 *   { type: 'error',      message: string }
 *   { type: 'progress',   percent: number }   ← optional encoding progress
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME    = 'ConversationRecorder';
const DB_VERSION = 1;
const STORE_NAME = 'audio_chunks';

/**
 * Output sample rate for the final WAV file.
 * Decision: 16 kHz is sufficient for voice/speech (Nyquist covers up to 8 kHz,
 * which captures all phonemes). Using 16 kHz rather than 24 kHz saves ~33% in
 * output file size. Both streams converge here — user is already 16 kHz,
 * AI (24 kHz) is downsampled.
 */
const OUTPUT_SAMPLE_RATE = 16000;

/**
 * AI audio from Gemini arrives at 24 kHz.
 * User audio from the pcm-processor worklet arrives at 16 kHz.
 */
const AI_SAMPLE_RATE   = 24000;
const USER_SAMPLE_RATE = 16000;

/**
 * Minimum silence gap (in ms) to insert between turns when chunks from
 * different speakers don't already have a natural gap via timestamps.
 * Keeps the WAV from sounding like one continuous stream.
 */
const MIN_TURN_GAP_MS = 150;

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {IDBDatabase|null} */
let db = null;

/** Current session id — set on 'init'. All IDB records are keyed by this. */
let currentSessionId = null;

/**
 * Serial write queue.
 * Each new chunk write is chained onto this promise so that at most one IDB
 * transaction is active at a time. This prevents "TransactionInactiveError"
 * and ensures chunks are stored in the exact order they arrive.
 */
let writeQueue = Promise.resolve();

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

/**
 * Open (or create) the IndexedDB database.
 * Called once on 'init'. Subsequent chunk writes reuse the same `db` handle.
 *
 * Schema:
 *   Object store: audio_chunks
 *     - id          (auto-increment, keyPath)         — unique row id
 *     - sessionId   (string)                          — groups a call's chunks
 *     - role        ('user' | 'ai')                   — who is speaking
 *     - timestamp   (number, ms since session start)  — ordering key
 *     - sampleRate  (number)                          — 16000 or 24000
 *     - buffer      (ArrayBuffer, Int16 PCM)          — raw audio data
 *
 * Index 'sessionId_timestamp' covers sessionId+timestamp so the finalize
 * query can retrieve all chunks for a session sorted chronologically in a
 * single IDB cursor pass — O(N log N) via the B-tree index.
 *
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Guard: only create the store if it doesn't already exist (idempotent
      // for re-opens across hot reloads in development).
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });

        // Compound index allows efficient retrieval of all chunks for a single
        // session ordered by timestamp — used in the finalize step.
        store.createIndex('sessionId_timestamp', ['sessionId', 'timestamp'], {
          unique: false,
        });
      }
    };

    request.onsuccess  = (event) => resolve(event.target.result);
    request.onerror    = ()      => reject(new Error('Failed to open IndexedDB: ' + request.error?.message));
    request.onblocked  = ()      => reject(new Error('IndexedDB open blocked by an older tab'));
  });
}

// ─── Chunk Storage ────────────────────────────────────────────────────────────

/**
 * Write a single audio chunk to IndexedDB.
 * This is always called through `enqueueWrite` to maintain serial ordering.
 *
 * @param {'user'|'ai'} role
 * @param {ArrayBuffer} buffer   Int16 PCM samples (ownership transferred to IDB)
 * @param {number}      timestamp  ms since session start
 * @param {number}      sampleRate 16000 (user) | 24000 (ai)
 * @returns {Promise<void>}
 */
function writeChunkToIDB(role, buffer, timestamp, sampleRate) {
  return new Promise((resolve, reject) => {
    if (!db || !currentSessionId) {
      // Defensive: should never happen if init was called first.
      reject(new Error('Recorder worker not initialized'));
      return;
    }

    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.add({
      sessionId : currentSessionId,
      role,
      timestamp,
      sampleRate,
      // ArrayBuffer stored directly in IDB — no base64 overhead, no
      // copy needed since ownership was already transferred to the worker.
      buffer,
    });

    tx.oncomplete = resolve;
    tx.onerror    = () => reject(new Error('IDB write failed: ' + tx.error?.message));
    tx.onabort    = () => reject(new Error('IDB transaction aborted'));
  });
}

/**
 * Enqueue a chunk write onto the serial promise chain.
 * Returns immediately — the caller (onmessage) is never blocked.
 *
 * WHY serial, not concurrent?
 * Audio arrives at ~25 chunks/sec. If we open 25 simultaneous IDB
 * transactions, we risk conflicting reads/writes on the same store.
 * Chaining each write resolves them one after another — they're still
 * async/non-blocking, just ordered.
 *
 * @param {'user'|'ai'} role
 * @param {ArrayBuffer} buffer
 * @param {number}      timestamp
 * @param {number}      sampleRate
 */
function enqueueWrite(role, buffer, timestamp, sampleRate) {
  writeQueue = writeQueue
    .then(() => writeChunkToIDB(role, buffer, timestamp, sampleRate))
    .catch((err) => {
      // Log but don't rethrow — a single chunk loss is acceptable; we don't
      // want one bad write to break the queue for all subsequent chunks.
      console.error('[recorder-worker] IDB write error — chunk dropped:', err);
    });
}

// ─── Audio Processing Utilities ───────────────────────────────────────────────

/**
 * Downsample an Int16 PCM buffer from `inputRate` to `outputRate`
 * using linear interpolation.
 *
 * DECISION — why linear interpolation (not sinc)?
 * Sinc/polyphase resampling gives higher audio quality (avoids aliasing),
 * but it's significantly more complex and slower to compute. For voice chat
 * at 24 kHz → 16 kHz (ratio = 1.5), linear interpolation introduces barely
 * audible aliasing — speech intelligibility is unaffected. This keeps the
 * worker code simple and the final encoding fast.
 *
 * DECISION — Int16 throughout, not Float32?
 * Keeping samples as Int16 halves memory during assembly. We only need to
 * write them to the DataView as Int16 for the WAV file anyway.
 *
 * @param {Int16Array} input      Source samples at inputRate
 * @param {number}     inputRate  e.g. 24000
 * @param {number}     outputRate e.g. 16000
 * @returns {Int16Array}          Resampled samples at outputRate
 */
function resampleInt16(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input; // no-op for user audio

  const ratio        = inputRate / outputRate; // 24000/16000 = 1.5
  const outputLength = Math.floor(input.length / ratio);
  const output       = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx  = i * ratio;          // 0, 1.5, 3, 4.5 …
    const i1      = Math.floor(srcIdx);
    const i2      = Math.min(i1 + 1, input.length - 1);
    const frac    = srcIdx - i1;

    // Linear interpolation between adjacent samples.
    // Rounding avoids truncation bias that would slightly reduce amplitude.
    output[i] = Math.round(input[i1] * (1 - frac) + input[i2] * frac);
  }

  return output;
}

/**
 * Convert milliseconds offset to the equivalent number of samples at
 * the output sample rate (16 kHz).
 *
 * @param {number} ms
 * @returns {number} sample count (integer)
 */
function msToSamples(ms) {
  return Math.floor((ms * OUTPUT_SAMPLE_RATE) / 1000);
}

// ─── WAV Encoding ─────────────────────────────────────────────────────────────

/**
 * Encode a flat Int16Array of PCM samples into a WAV ArrayBuffer.
 *
 * WAV format (little-endian):
 *   Bytes 0–3:   "RIFF"
 *   Bytes 4–7:   Total file size − 8
 *   Bytes 8–11:  "WAVE"
 *   Bytes 12–15: "fmt "
 *   Bytes 16–19: Subchunk1Size = 16 (PCM)
 *   Bytes 20–21: AudioFormat = 1 (PCM linear)
 *   Bytes 22–23: NumChannels = 1 (mono)
 *   Bytes 24–27: SampleRate
 *   Bytes 28–31: ByteRate = SampleRate × NumChannels × BitsPerSample/8
 *   Bytes 32–33: BlockAlign = NumChannels × BitsPerSample/8
 *   Bytes 34–35: BitsPerSample = 16
 *   Bytes 36–39: "data"
 *   Bytes 40–43: Subchunk2Size = NumSamples × NumChannels × BitsPerSample/8
 *   Bytes 44…:   Raw PCM samples (Int16, little-endian)
 *
 * DECISION — WAV over MP3/OGG?
 * WAV requires no external codec library, so encoding is 100% pure JS with
 * no npm dependency. It is lossless (identical to the original PCM source),
 * and all major OS media players open it natively. MP3/OGG would require
 * libmp3lame or an opus wasm module — adding complexity, bundle size, and
 * licensing concerns. The user said "uploading to server will be implemented
 * later", so WAV is the pragmatic choice for a local download.
 *
 * @param {Int16Array} samples   Flat mono PCM samples
 * @param {number}     sampleRate
 * @returns {ArrayBuffer}        Complete WAV file bytes
 */
function encodeWAV(samples, sampleRate) {
  const dataByteLength = samples.length * 2; // 2 bytes per Int16 sample
  const buffer         = new ArrayBuffer(44 + dataByteLength);
  const view           = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // ── RIFF chunk ─────────────────────────────────────────────────────────────
  writeString(0, 'RIFF');
  view.setUint32(4,  36 + dataByteLength, true); // file size - 8
  writeString(8, 'WAVE');

  // ── fmt  sub-chunk ─────────────────────────────────────────────────────────
  writeString(12, 'fmt ');
  view.setUint32(16, 16,         true); // PCM chunk size
  view.setUint16(20, 1,          true); // AudioFormat: PCM = 1
  view.setUint16(22, 1,          true); // NumChannels: mono = 1
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate = SR × 1ch × 2bytes
  view.setUint16(32, 2,          true); // BlockAlign = 1ch × 2 bytes
  view.setUint16(34, 16,         true); // BitsPerSample

  // ── data sub-chunk ─────────────────────────────────────────────────────────
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  // Write PCM samples (little-endian Int16).
  // DECISION: We write directly from Int16Array via DataView rather than
  // using a typed array copy so we stay within the single allocated buffer —
  // no extra 57 MB allocation at encode time.
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return buffer;
}

// ─── Finalize (Assembly + Encode + Download) ──────────────────────────────────

/**
 * Read all audio chunks for the current session from IDB, resample the AI
 * audio from 24 kHz → 16 kHz, assemble them into a single chronological
 * PCM timeline (inserting silence between turns), encode as WAV, and post
 * the Blob back to the main thread.
 *
 * Timeline assembly algorithm:
 *   1. Sort all chunks by timestamp (IDB index already gives us this order).
 *   2. Maintain a `cursor` = current write position in the output array (samples).
 *   3. For each chunk:
 *      a. Compute expectedStart = msToSamples(chunk.timestamp).
 *      b. If cursor < expectedStart, fill [cursor … expectedStart) with silence (0).
 *         This preserves the natural timing of real pauses between turns.
 *      c. Write the chunk's samples starting at cursor (or expectedStart if ahead).
 *      d. Advance cursor.
 *   4. Encode the assembled Int16 timeline as WAV.
 *
 * DECISION — silence insertion via timestamps vs. fixed gaps:
 * Using the actual `timestamp` (ms since session start) we captured per chunk
 * gives the most accurate reflection of real conversation timing. If the user
 * paused 2 seconds before replying, the WAV will have 2 seconds of silence —
 * which is audibly natural. A fixed gap (e.g. 300 ms always) would feel
 * unnatural and lose the cadence of the conversation.
 */
async function finalizeRecording() {
  if (!db || !currentSessionId) {
    self.postMessage({ type: 'error', message: 'Recorder not initialized' });
    return;
  }

  try {
    // ── 1. Wait for all pending writes to complete ─────────────────────────
    // The writeQueue promise chain may still have a few chunks in flight
    // (the most recent chunks posted just before "finalize"). We await it
    // so we don't miss the tail end of the session.
    await writeQueue;

    // ── 2. Read all chunks for this session from IDB (sorted by timestamp) ─
    self.postMessage({ type: 'progress', percent: 5 });

    const chunks = await readAllChunks(currentSessionId);

    if (chunks.length === 0) {
      self.postMessage({ type: 'error', message: 'No audio data recorded' });
      return;
    }

    self.postMessage({ type: 'progress', percent: 20 });

    // ── 3. Calculate total output size ─────────────────────────────────────
    // We need to know the total sample count up-front to allocate a single
    // contiguous Int16Array (one allocation, zero re-allocations).
    //
    // Total time = last chunk's timestamp + its duration
    const lastChunk       = chunks[chunks.length - 1];
    const lastChunkSamples = new Int16Array(lastChunk.buffer);
    // Duration of last chunk at OUTPUT rate (resample if needed)
    const lastChunkDuration = Math.floor(
      lastChunkSamples.length / (lastChunk.sampleRate / OUTPUT_SAMPLE_RATE)
    );
    const totalSamples = msToSamples(lastChunk.timestamp) + lastChunkDuration;

    // Int16Array filled with zeros = silence by default.
    const output = new Int16Array(totalSamples);

    self.postMessage({ type: 'progress', percent: 35 });

    // ── 4. Assemble timeline ───────────────────────────────────────────────
    let cursor = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const rawSamples = new Int16Array(chunk.buffer);

      // Downsample AI audio (24 kHz → 16 kHz). User audio is a no-op here.
      const samples = resampleInt16(rawSamples, chunk.sampleRate, OUTPUT_SAMPLE_RATE);

      // Where this chunk should start in the output timeline.
      const expectedStart = msToSamples(chunk.timestamp);

      // If there is a gap between the current cursor and the expected start,
      // the Int16Array is already zero-filled (silence) — nothing to write.
      // Just advance the cursor to the expected start position.
      if (cursor < expectedStart) {
        cursor = expectedStart;
      }

      // If cursor > expectedStart (overlap — shouldn't happen in voice chat
      // since turns don't overlap), we still write at `cursor` to avoid
      // overwriting already-written data. This is a safety guard.

      // Write samples if there is room.
      const available = output.length - cursor;
      const toWrite   = Math.min(samples.length, available);
      output.set(samples.subarray(0, toWrite), cursor);
      cursor += toWrite;

      // Emit progress every 10% of chunks.
      if (ci % Math.ceil(chunks.length / 10) === 0) {
        const pct = 35 + Math.floor((ci / chunks.length) * 50);
        self.postMessage({ type: 'progress', percent: pct });
      }
    }

    self.postMessage({ type: 'progress', percent: 88 });

    // ── 5. Encode to WAV ───────────────────────────────────────────────────
    const wavBuffer = encodeWAV(output, OUTPUT_SAMPLE_RATE);

    // ── 6. Create Blob and post to main thread ──────────────────────────────
    // 'audio/wav' is the correct MIME for WAV files; browsers and OSes
    // recognize this for media player association.
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });

    self.postMessage({ type: 'progress', percent: 95 });

    // Transfer the wavBuffer to avoid a copy in the Blob constructor path.
    // The Blob internally holds a reference so this is safe.
    self.postMessage({ type: 'wav_ready', blob });

    self.postMessage({ type: 'progress', percent: 100 });

    // ── 7. Clean up IDB records for this session ───────────────────────────
    await cleanupSession(currentSessionId);

  } catch (err) {
    console.error('[recorder-worker] Finalize error:', err);
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Read all audio chunks for a session from IDB in timestamp order.
 * Uses the compound index 'sessionId_timestamp' to avoid a full table scan.
 *
 * @param {string} sessionId
 * @returns {Promise<Array<{role, timestamp, sampleRate, buffer}>>}
 */
function readAllChunks(sessionId) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionId_timestamp');

    // IDBKeyRange: all records where sessionId == currentSessionId.
    // 'sessionId_timestamp' is a compound index so the lower/upper bounds
    // must be arrays matching the index key path.
    const range   = IDBKeyRange.bound(
      [sessionId, -Infinity],
      [sessionId, Infinity]
    );
    const request = index.openCursor(range, 'next'); // ascending by timestamp

    const results = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(new Error('IDB read failed: ' + request.error?.message));
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete all IDB records belonging to `sessionId`.
 * Called automatically after a successful finalize, and also when the main
 * thread sends { type: 'cleanup' } (e.g. if the user navigates away without
 * ending the call, or if finalize isn't needed).
 *
 * DECISION — delete by session not full clear:
 * The user may eventually open multiple tabs or have two sessions. Deleting
 * only the current session's records (via the index + KeyRange) is safe and
 * idempotent. A full clear would corrupt any other session's data.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
function cleanupSession(sessionId) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionId_timestamp');
    const range = IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity]);

    // Open a cursor and delete each matching record.
    // IDB doesn't have a "delete by index" shortcut, so cursor-delete is the
    // standard pattern.
    const request = index.openCursor(range, 'next');
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = resolve;
    tx.onerror    = () => reject(new Error('Cleanup failed: ' + tx.error?.message));
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { type } = event.data;

  switch (type) {
    // ── init ────────────────────────────────────────────────────────────────
    case 'init': {
      try {
        currentSessionId = event.data.sessionId;
        // Open (or reuse) the database. This is idempotent — the same db
        // handle is reused for the lifetime of the worker.
        if (!db) {
          db = await openDatabase();
        }
        // Reset the write queue (fresh promise chain per session).
        writeQueue = Promise.resolve();
        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', message: 'DB init failed: ' + err.message });
      }
      break;
    }

    // ── user_chunk ──────────────────────────────────────────────────────────
    // The main thread transferred ownership via Transferable. The buffer
    // arrives here detached from the main thread — zero copy, zero GC
    // pressure on the main thread.
    case 'user_chunk': {
      const { buffer, timestamp } = event.data;
      enqueueWrite('user', buffer, timestamp, USER_SAMPLE_RATE);
      break;
    }

    // ── ai_chunk ────────────────────────────────────────────────────────────
    // Gemini AI audio arrives at 24 kHz. We store it raw (24 kHz) here and
    // downsample during finalize, so we don't block the recording path with
    // CPU-intensive resampling for every ~4 KB chunk.
    case 'ai_chunk': {
      const { buffer, timestamp } = event.data;
      enqueueWrite('ai', buffer, timestamp, AI_SAMPLE_RATE);
      break;
    }

    // ── finalize ────────────────────────────────────────────────────────────
    case 'finalize': {
      await finalizeRecording();
      break;
    }

    // ── cleanup ─────────────────────────────────────────────────────────────
    // Clears IDB records without generating a WAV. Called when a session is
    // abandoned (e.g. credit exhausted + user doesn't want to download).
    case 'cleanup': {
      if (db && currentSessionId) {
        await cleanupSession(currentSessionId).catch(console.error);
      }
      break;
    }

    default:
      console.warn('[recorder-worker] Unknown message type:', type);
  }
};
