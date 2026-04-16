/// <reference lib="webworker" />

/**
 * recorder.worker.ts
 * ================================
 * Persistent Web Worker responsible for:
 *   1. Ingesting audio chunks (user mic + Gemini AI) into IndexedDB via a
 *      serialized write queue — keeping the main thread 100% free of disk I/O.
 *   2. On "finalize": reading all session chunks from IDB, feeding them to
 *      a Mediabunny WebM Opus encoder pipeline which preserves accurate PTS
 *      (Presentation Timestamps) natively.
 *   3. Posting the finished WebM Blob back to the main thread for download.
 *   4. Cleaning up IndexedDB records after the session is done.
 */

import {
  Output,
  WebMOutputFormat,
  BufferTarget,
  AudioSampleSource,
  AudioSample,
} from "mediabunny";

const DB_NAME = "ConversationRecorder";
const DB_VERSION = 1;
const STORE_NAME = "audio_chunks";

const AI_SAMPLE_RATE = 24000;
const USER_SAMPLE_RATE = 16000;

// ─── State ────────────────────────────────────────────────────────────────────

let db: IDBDatabase | null = null;
let currentSessionId: string | null = null;

let writeQueue = Promise.resolve();

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });

        store.createIndex("sessionId_timestamp", ["sessionId", "timestamp"], {
          unique: false,
        });
      }
    };

    request.onsuccess = (event) =>
      resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () =>
      reject(new Error("Failed to open IndexedDB: " + request.error?.message));
    request.onblocked = () =>
      reject(new Error("IndexedDB open blocked by an older tab"));
  });
}

// ─── Chunk Storage ────────────────────────────────────────────────────────────

function writeChunkToIDB(
  role: "user" | "ai",
  buffer: ArrayBuffer,
  timestamp: number,
  sampleRate: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db || !currentSessionId) {
      reject(new Error("Recorder worker not initialized"));
      return;
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.add({
      sessionId: currentSessionId,
      role,
      timestamp,
      sampleRate,
      buffer,
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("IDB write failed: " + tx.error?.message));
    tx.onabort = () => reject(new Error("IDB transaction aborted"));
  });
}

function enqueueWrite(
  role: "user" | "ai",
  buffer: ArrayBuffer,
  timestamp: number,
  sampleRate: number,
) {
  writeQueue = writeQueue
    .then(() => writeChunkToIDB(role, buffer, timestamp, sampleRate))
    .catch((err) => {
      console.error("[recorder-worker] IDB write error — chunk dropped:", err);
    });
}

function resampleToFloat32(
  input: Int16Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const i1 = Math.floor(srcIdx);
    const i2 = Math.min(i1 + 1, input.length - 1);
    const frac = srcIdx - i1;
    // Linear intp + Normalize to [-1.0, 1.0] for f32
    output[i] = (input[i1] * (1 - frac) + input[i2] * frac) / 32768.0;
  }
  return output;
}

// ─── Finalize (Assembly + Encode + Download) ──────────────────────────────────

async function finalizeRecording() {
  if (!db || !currentSessionId) {
    self.postMessage({ type: "error", message: "Recorder not initialized" });
    return;
  }

  try {
    await writeQueue;
    self.postMessage({ type: "progress", percent: 5 });

    const chunks = await readAllChunks(currentSessionId);

    if (chunks.length === 0) {
      self.postMessage({ type: "error", message: "No audio data recorded" });
      return;
    }

    self.postMessage({ type: "progress", percent: 20 });

    const AUDIO_OUTPUT_RATE = 48000;

    // ── Create Media Pipeline ──────────────────────────────────────────────
    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    });

    const audioSource = new AudioSampleSource({
      codec: "opus",
      //@ts-ignore
      numberOfChannels: 1,
      sampleRate: AUDIO_OUTPUT_RATE, // Opus natively demands 48kHz cleanly
      bitrate: 64000,
    });

    output.addAudioTrack(audioSource);
    await output.start();

    // ── Feed Sequence to Mediabunny ───────────────────────────────────────
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];

      const rawSamples = new Int16Array(chunk.buffer);
      // Synchronize AI + User chunks faithfully to normalized 48kHz floats before adding
      const resampledData = resampleToFloat32(
        rawSamples,
        chunk.sampleRate,
        AUDIO_OUTPUT_RATE,
      );

      const sample = new AudioSample({
        data: resampledData,
        format: "f32-planar", // Float32 is universally supported for Opus AudioEncoders natively
        numberOfChannels: 1,
        sampleRate: AUDIO_OUTPUT_RATE,
        timestamp: chunk.timestamp / 1000, // Mediabunny expects seconds
      });

      // Mediabunny automatically aligns PTS. Gaps between calls dynamically represent silence implicitly in the Opus WebM stream.
      try {
        await audioSource.add(sample);
      } finally {
        // AudioSample releases WebCodecs references quickly, must be closed even if encoding fails
        sample.close();
      }

      if (ci % Math.ceil(chunks.length / 10) === 0) {
        const pct = 20 + Math.floor((ci / chunks.length) * 60);
        self.postMessage({ type: "progress", percent: pct });
      }
    }

    self.postMessage({ type: "progress", percent: 85 });

    await output.finalize();

    self.postMessage({ type: "progress", percent: 95 });

    const webmBuffer = (output.target as BufferTarget).buffer;
    if (!webmBuffer) throw new Error("Output target buffer missing.");

    const blob = new Blob([webmBuffer], { type: "audio/webm;codecs=opus" });

    self.postMessage({ type: "webm_ready", blob });
    self.postMessage({ type: "progress", percent: 100 });

    await cleanupSession(currentSessionId);
  } catch (err: unknown) {
    console.error("[recorder-worker] Finalize error:", err);
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readAllChunks(sessionId: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not open"));
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sessionId_timestamp");

    const range = IDBKeyRange.bound(
      [sessionId, -Infinity],
      [sessionId, Infinity],
    );
    const request = index.openCursor(range, "next");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () =>
      reject(new Error("IDB read failed: " + request.error?.message));
  });
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

function cleanupSession(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not open"));
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("sessionId_timestamp");
    const range = IDBKeyRange.bound(
      [sessionId, -Infinity],
      [sessionId, Infinity],
    );

    const request = index.openCursor(range, "next");
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("Cleanup failed: " + tx.error?.message));
  });
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;

  switch (type) {
    case "init": {
      try {
        currentSessionId = event.data.sessionId;
        if (!db) {
          db = await openDatabase();
        }
        writeQueue = Promise.resolve();
        self.postMessage({ type: "ready" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        self.postMessage({
          type: "error",
          message: "DB init failed: " + err.message,
        });
      }
      break;
    }

    case "user_chunk": {
      const { buffer, timestamp } = event.data;
      enqueueWrite("user", buffer, timestamp, USER_SAMPLE_RATE);
      break;
    }

    case "ai_chunk": {
      const { buffer, timestamp } = event.data;
      enqueueWrite("ai", buffer, timestamp, AI_SAMPLE_RATE);
      break;
    }

    case "finalize": {
      await finalizeRecording();
      break;
    }

    case "cleanup": {
      if (db && currentSessionId) {
        await cleanupSession(currentSessionId).catch(console.error);
      }
      break;
    }

    default:
      console.warn("[recorder-worker] Unknown message type:", type);
  }
});
