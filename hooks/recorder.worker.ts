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

// ── Continuous timestamp tracking ───────────────────────────────────────────
// Wall-clock timestamps from Date.now() have jitter and include real-time
// pauses as silence gaps. Instead, we track a running sample counter per role
// so consecutive chunks stitch together with zero gaps or overlaps.
// Each counter represents microseconds of audio received so far for that role.
let userContinuousTs = 0; // µs of user audio accumulated
let aiContinuousTs = 0; // µs of AI audio accumulated

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

/**
 * Merge user and AI chunk streams into a single compact Float32 timeline.
 *
 * Strategy:
 *   1. Separate chunks by role and resample everything to 48 kHz.
 *   2. Concatenate each role's chunks into one continuous buffer (no gaps,
 *      no wall-clock pauses — chunks are stitched back-to-back).
 *   3. Mix the two role buffers sample-by-sample. Where both overlap we
 *      sum + soft-clip; where only one exists we use it directly.
 *   4. Feed the single mixed buffer to Mediabunny as one AudioSample at
 *      timestamp 0 — no per-chunk timestamps means no PTS jitter.
 */

const AUDIO_OUTPUT_RATE = 48000;

function concatRoleChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunks: any[],
  originalRate: number,
): Float32Array {
  // Pass 1: resample each chunk and compute total length
  const resampled: Float32Array[] = [];
  let totalLen = 0;
  for (const chunk of chunks) {
    const raw = new Int16Array(chunk.buffer);
    const f32 = resampleToFloat32(raw, originalRate, AUDIO_OUTPUT_RATE);
    resampled.push(f32);
    totalLen += f32.length;
  }

  // Pass 2: concatenate into one buffer
  const out = new Float32Array(totalLen);
  let offset = 0;
  for (const seg of resampled) {
    out.set(seg, offset);
    offset += seg.length;
  }
  return out;
}

/**
 * Soft-clip: fast tanh-like curve that tames summed peaks while preserving
 * quiet-to-normal signal linearity. Cheaper than Math.tanh.
 */
function softClip(x: number): number {
  if (x > 1.5) return 1.0;
  if (x < -1.5) return -1.0;
  return x - (x * x * x) / 6.75;
}

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

    self.postMessage({ type: "progress", percent: 15 });

    // ── Separate by role ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userChunks: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiChunks: any[] = [];
    for (const c of chunks) {
      if (c.role === "user") userChunks.push(c);
      else aiChunks.push(c);
    }

    self.postMessage({ type: "progress", percent: 25 });

    // ── Concatenate each role into a continuous buffer ───────────────────────
    const userBuf = concatRoleChunks(userChunks, USER_SAMPLE_RATE);
    const aiBuf = concatRoleChunks(aiChunks, AI_SAMPLE_RATE);

    self.postMessage({ type: "progress", percent: 40 });

    // ── Mix into a single output buffer ─────────────────────────────────────
    // User and AI buffers are placed back-to-back per role. We mix by summing
    // sample-by-sample with soft-clipping to prevent overs.
    const mixLen = Math.max(userBuf.length, aiBuf.length);
    const mixed = new Float32Array(mixLen);

    for (let i = 0; i < mixLen; i++) {
      const u = i < userBuf.length ? userBuf[i] : 0;
      const a = i < aiBuf.length ? aiBuf[i] : 0;
      mixed[i] = softClip(u + a);
    }

    self.postMessage({ type: "progress", percent: 55 });

    // ── Encode with Mediabunny ──────────────────────────────────────────────
    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    });

    const audioSource = new AudioSampleSource({
      codec: "opus",
      //@ts-ignore
      numberOfChannels: 1,
      sampleRate: AUDIO_OUTPUT_RATE,
      bitrate: 64000,
    });

    output.addAudioTrack(audioSource);
    await output.start();

    self.postMessage({ type: "progress", percent: 60 });

    // Feed in manageable segments (1 second each) to avoid blocking and
    // to give the encoder a chance to flush internal buffers.
    const SEGMENT_SAMPLES = AUDIO_OUTPUT_RATE; // 1 second
    const totalSegments = Math.ceil(mixed.length / SEGMENT_SAMPLES);

    for (let si = 0; si < totalSegments; si++) {
      const start = si * SEGMENT_SAMPLES;
      const end = Math.min(start + SEGMENT_SAMPLES, mixed.length);
      const segmentData = mixed.subarray(start, end);

      const sample = new AudioSample({
        data: segmentData,
        format: "f32-planar",
        numberOfChannels: 1,
        sampleRate: AUDIO_OUTPUT_RATE,
        timestamp: start / AUDIO_OUTPUT_RATE, // seconds, derived from sample position
      });

      try {
        await audioSource.add(sample);
      } finally {
        sample.close();
      }

      // Progress: 60% – 85% during encoding
      const pct = 60 + Math.floor(((si + 1) / totalSegments) * 25);
      self.postMessage({ type: "progress", percent: pct });
    }

    self.postMessage({ type: "progress", percent: 90 });

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
        // Reset continuous timestamp counters for the new session
        userContinuousTs = 0;
        aiContinuousTs = 0;
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
      const { buffer } = event.data;
      // Use continuous sample-count timestamp instead of wall-clock time.
      // This ensures chunks stitch seamlessly with no jitter gaps.
      const userSamples = buffer.byteLength / 2; // Int16 = 2 bytes per sample
      const userChunkDurationUs = (userSamples / USER_SAMPLE_RATE) * 1_000_000;
      enqueueWrite("user", buffer, userContinuousTs, USER_SAMPLE_RATE);
      userContinuousTs += userChunkDurationUs;
      break;
    }

    case "ai_chunk": {
      const { buffer } = event.data;
      const aiSamples = buffer.byteLength / 2;
      const aiChunkDurationUs = (aiSamples / AI_SAMPLE_RATE) * 1_000_000;
      enqueueWrite("ai", buffer, aiContinuousTs, AI_SAMPLE_RATE);
      aiContinuousTs += aiChunkDurationUs;
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
