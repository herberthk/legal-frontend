/// <reference lib="webworker" />

/**
 * recorder.worker.ts
 * ================================
 * Persistent Web Worker responsible for:
 *   1. Ingesting audio chunks (user mic + Gemini AI) into IndexedDB via a
 *      serialized write queue — keeping the main thread 100% free of disk I/O.
 *   2. On "finalize": reading all session chunks from IDB, assembling them
 *      into a compact WebM Opus file via Mediabunny with accurate timing.
 *   3. Posting the finished WebM Blob back to the main thread for download.
 *   4. Cleaning up IndexedDB records after the session is done.
 *
 * ── Recording quality notes ─────────────────────────────────────────────────
 *  Chunks are stored with wall-clock timestamps for correct ordering.
 *  During finalize, consecutive same-role chunks are stitched gap-free
 *  (eliminating click/pop artifacts from Date.now() jitter), and silence
 *  gaps between role transitions are capped at MAX_GAP_S to produce a
 *  compact file that still sounds like a natural conversation.
 */

import {
  Output,
  WebMOutputFormat,
  BufferTarget,
  AudioSampleSource,
  AudioSample,
} from "mediabunny";

const DB_NAME = "ConversationRecorder";
const DB_VERSION = 2;
const STORE_NAME = "audio_chunks";
const META_STORE_NAME = "sessions";

/**
 * How long an unfinished session's PCM is kept before it is reclaimed.
 * Chunks are the only copy of the audio until the WebM has been uploaded, so
 * they outlive the worker deliberately: a tab closed mid-upload must not lose
 * the recording. The prune at the start of the next session is what bounds the
 * storage, not the end of the previous one.
 */
const CHUNK_RETENTION_MS = 24 * 60 * 60 * 1000;

const AI_SAMPLE_RATE = 24000;
const USER_SAMPLE_RATE = 16000;
const AUDIO_OUTPUT_RATE = 48000;

/**
 * Maximum silence gap (seconds) preserved between conversation turns.
 * Gaps longer than this are capped to avoid huge dead-air stretches from
 * network stalls or very long AI thinking pauses (> 10 s).
 * Set high enough that normal conversation pauses are preserved faithfully.
 */
const MAX_GAP_S = 8.0;

// ─── State ────────────────────────────────────────────────────────────────────

let db: IDBDatabase | null = null;
let currentSessionId: string | null = null;

/**
 * Set when another tab needs to upgrade the database and we have to let go of
 * our connection. A closed IDBDatabase is still a non-null object, so this flag
 * is the only way to tell that `db` can no longer serve a transaction — without
 * it, every write throws InvalidStateError from inside the constructor callback
 * rather than rejecting, and the chunk is lost with a confusing error.
 */
let dbClosed = false;

let writeQueue = Promise.resolve();

// ─── IndexedDB Setup ──────────────────────────────────────────────────────────

/**
 * Give every session already on disk a metadata row.
 *
 * Chunks written before v2 have no row in the meta store, and the prune walks
 * only that store — so without this, pre-upgrade chunks are invisible to it and
 * nothing else deletes them any more. They are stamped with the upgrade time
 * rather than their real start: chunk timestamps are offsets from the start of
 * their own session, not wall-clock, so they cannot date a session. The effect
 * is one retention window of grace before legacy audio is reclaimed.
 */
function seedLegacySessionMeta(transaction: IDBTransaction) {
  const chunkStore = transaction.objectStore(STORE_NAME);
  const metaStore = transaction.objectStore(META_STORE_NAME);
  const seededAt = Date.now();

  // nextunique on the compound index visits each sessionId once instead of
  // walking every chunk of every session.
  const cursorRequest = chunkStore
    .index("sessionId_timestamp")
    .openKeyCursor(null, "nextunique");

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;

    const sessionId = (cursor.key as [string, number])[0];
    if (sessionId) {
      // add, not put: never move the clock forward on a session that already
      // has a row, or a busy database could keep renewing its own garbage.
      const addRequest = metaStore.add({ sessionId, startedAt: seededAt });
      addRequest.onerror = (event) => {
        // ConstraintError just means the row exists. Swallow it so it does not
        // abort the whole versionchange transaction and fail the upgrade.
        event.preventDefault();
        event.stopPropagation();
      };
    }

    cursor.continue();
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const isNewDatabase = event.oldVersion === 0;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });

        store.createIndex("sessionId_timestamp", ["sessionId", "timestamp"], {
          unique: false,
        });
      }

      // v2: per-session metadata, so a session's chunks can be pruned by age
      // without needing the tab that recorded them to still be alive.
      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: "sessionId" });
      }

      // Only an existing database can be carrying chunks that predate the meta
      // store; a fresh one has nothing to back-fill.
      if (!isNewDatabase && request.transaction) {
        seedLegacySessionMeta(request.transaction);
      }
    };

    request.onsuccess = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Another tab is upgrading. Holding the connection open would block it
      // indefinitely, so close and mark the handle dead — the next init opens a
      // fresh one at the new version.
      database.onversionchange = () => {
        dbClosed = true;
        database.close();
        if (db === database) db = null;
        console.warn(
          "[recorder-worker] Database closed for an upgrade in another tab",
        );
      };

      // Fires on a forced close (storage eviction, corruption). Same handling:
      // the handle is unusable from here on.
      database.onclose = () => {
        dbClosed = true;
        if (db === database) db = null;
      };

      dbClosed = false;
      resolve(database);
    };
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
    if (!db || dbClosed || !currentSessionId) {
      reject(new Error("Recorder worker not initialized"));
      return;
    }

    // A closed connection throws synchronously from .transaction(), which would
    // escape this executor as an exception rather than a rejection and skip the
    // caller's catch. Convert it so a dropped chunk stays a handled error.
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, "readwrite");
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

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

// ─── Segment grouping ─────────────────────────────────────────────────────────

interface Segment {
  role: "user" | "ai";
  /** Wall-clock timestamp (ms) of the first chunk in this segment */
  wallStartMs: number;
  /** Wall-clock timestamp (ms) of the last chunk's end in this segment */
  wallEndMs: number;
  /** Resampled Float32 samples at AUDIO_OUTPUT_RATE, stitched gap-free */
  samples: Float32Array;
}

/**
 * Group consecutive same-role chunks into segments, stitching their audio
 * seamlessly (no jitter gaps). The wall-clock timestamps are preserved on
 * the segment for ordering, but internal chunk boundaries are eliminated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupIntoSegments(chunks: any[]): Segment[] {
  if (chunks.length === 0) return [];

  const segments: Segment[] = [];
  let currentRole: string = chunks[0].role;
  let segChunks: Float32Array[] = [];
  let segWallStartMs: number = chunks[0].timestamp;
  let segWallEndMs: number = chunks[0].timestamp;
  
  // Accumulated real audio duration in ms for the current segment.
  // Used to compute the correct playback-end time for AI segments:
  // AI audio streams faster than real-time (Gemini sends 30 s of audio in
  // ~2 s), so lastChunk.timestamp underestimates when the AI stops speaking.
  // The true playback end = segWallStartMs + segAccumulatedDurationMs.
  let segAccumulatedDurationMs = 0;

  const flushSegment = () => {
    if (segChunks.length === 0) return;

    // Concatenate all resampled chunks into one continuous buffer
    let totalLen = 0;
    for (const c of segChunks) totalLen += c.length;
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of segChunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    // For AI: use playback-accurate wall end (start + total audio duration).
    // For user: chunks arrive in real-time so lastChunk.timestamp + duration
    //           is already accurate — keep segWallEndMs as-is.
    const accurateWallEndMs =
      currentRole === "ai"
        ? segWallStartMs + segAccumulatedDurationMs
        : segWallEndMs;

    segments.push({
      role: currentRole as "user" | "ai",
      wallStartMs: segWallStartMs,
      wallEndMs: accurateWallEndMs,
      samples: merged,
    });
  };

  for (const chunk of chunks) {
    if (chunk.role !== currentRole) {
      // Role changed — flush the current segment and start a new one
      flushSegment();
      currentRole = chunk.role;
      segChunks = [];
      segWallStartMs = chunk.timestamp;
      segWallEndMs = chunk.timestamp;
      segAccumulatedDurationMs = 0;
    }

    const raw = new Int16Array(chunk.buffer);
    const f32 = resampleToFloat32(raw, chunk.sampleRate, AUDIO_OUTPUT_RATE);
    segChunks.push(f32);

    // Accumulate the real audio duration of this chunk (ms)
    const chunkDurationMs = (raw.length / chunk.sampleRate) * 1000;
    segAccumulatedDurationMs += chunkDurationMs;

    // Track the wall-clock end of this chunk for gap calculations
    segWallEndMs = chunk.timestamp + chunkDurationMs;
  }

  // Flush the last segment
  flushSegment();

  return segments;
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

    self.postMessage({ type: "progress", percent: 15 });

    // ── Group consecutive same-role chunks into segments ─────────────────
    // Each segment's internal chunks are stitched gap-free (no jitter clicks).
    const segments = groupIntoSegments(chunks);

    self.postMessage({ type: "progress", percent: 25 });

    // ── Build a compact timeline ────────────────────────────────────────
    // Walk segments in order. Between segments, preserve the wall-clock gap
    // but cap it at MAX_GAP_S to compress long silences (thinking time, etc).
    // This keeps the recording compact while maintaining natural turn flow.
    let outputTimestamp = 0; // seconds — running position in the output file

    self.postMessage({ type: "progress", percent: 30 });

    // ── Create Media Pipeline ───────────────────────────────────────────
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

    self.postMessage({ type: "progress", percent: 35 });

    // ── Feed segments to Mediabunny ─────────────────────────────────────
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];

      // Insert a compressed gap between segments (role transitions or pauses)
      if (si > 0) {
        const wallGapMs = seg.wallStartMs - segments[si - 1].wallEndMs;
        const gapS = Math.min(Math.max(wallGapMs / 1000, 0), MAX_GAP_S);

        if (gapS > 0.01) {
          // Insert silence for the gap
          const silenceSamples = Math.floor(gapS * AUDIO_OUTPUT_RATE);
          const silence = new Float32Array(silenceSamples);
          const silenceSample = new AudioSample({
            data: silence,
            format: "f32-planar",
            numberOfChannels: 1,
            sampleRate: AUDIO_OUTPUT_RATE,
            timestamp: outputTimestamp,
          });
          try {
            await audioSource.add(silenceSample);
          } finally {
            silenceSample.close();
          }
          outputTimestamp += gapS;
        }
      }

      // Feed the segment's audio in 1-second sub-segments for smooth encoding.
      // IMPORTANT: use slice() (not subarray()) so each AudioSample owns an
      // independent copy of the data. subarray() returns a shared-memory view;
      // when sample.close() frees the encoder reference, later sub-segments
      // reading the same memory get stale/reused data → looping artefacts.
      const SEGMENT_SIZE = AUDIO_OUTPUT_RATE; // 1 second of samples
      const totalSubSegments = Math.ceil(seg.samples.length / SEGMENT_SIZE);

      for (let ssi = 0; ssi < totalSubSegments; ssi++) {
        const start = ssi * SEGMENT_SIZE;
        const end = Math.min(start + SEGMENT_SIZE, seg.samples.length);
        // slice() allocates a new Float32Array — safe to close the AudioSample
        // without affecting any subsequent sub-segment's backing memory.
        const subData = seg.samples.slice(start, end);
        const subDuration = subData.length / AUDIO_OUTPUT_RATE;

        const sample = new AudioSample({
          data: subData,
          format: "f32-planar",
          numberOfChannels: 1,
          sampleRate: AUDIO_OUTPUT_RATE,
          timestamp: outputTimestamp,
        });

        try {
          await audioSource.add(sample);
        } finally {
          sample.close();
        }

        outputTimestamp += subDuration;
      }

      // Progress: 35% – 85% during encoding
      const pct = 35 + Math.floor(((si + 1) / segments.length) * 50);
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

    // Deliberately NOT deleting the chunks here. The main thread still has to
    // upload this blob, and if that fails (or the tab is closed mid-upload) the
    // PCM is the only remaining copy. Records are reclaimed either by an
    // explicit `cleanup` once the upload is confirmed, or by the prune that
    // runs when the next session initialises.
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

/** Record/refresh a session's metadata row (used by the age-based prune). */
function touchSessionMeta(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not open"));
    const tx = db.transaction(META_STORE_NAME, "readwrite");
    tx.objectStore(META_STORE_NAME).put({ sessionId, startedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("Meta write failed: " + tx.error?.message));
  });
}

/** List session ids whose metadata is older than CHUNK_RETENTION_MS. */
function findExpiredSessions(exceptSessionId: string | null): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not open"));
    const cutoff = Date.now() - CHUNK_RETENTION_MS;
    const tx = db.transaction(META_STORE_NAME, "readonly");
    const request = tx.objectStore(META_STORE_NAME).openCursor();
    const expired: string[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const { sessionId, startedAt } = cursor.value ?? {};
        if (
          sessionId &&
          sessionId !== exceptSessionId &&
          (typeof startedAt !== "number" || startedAt < cutoff)
        ) {
          expired.push(sessionId);
        }
        cursor.continue();
      } else {
        resolve(expired);
      }
    };
    request.onerror = () =>
      reject(new Error("Meta read failed: " + request.error?.message));
  });
}

/**
 * Drop chunks belonging to sessions that were abandoned long enough ago that
 * their audio is no longer recoverable by any UI. Runs on `init` so storage is
 * bounded without an unmount ever having to destroy in-flight data.
 */
async function pruneExpiredSessions(exceptSessionId: string | null) {
  try {
    const expired = await findExpiredSessions(exceptSessionId);
    for (const sessionId of expired) {
      await cleanupSession(sessionId);
    }
    if (expired.length > 0) {
      console.info(
        `[recorder-worker] Pruned ${expired.length} expired session(s)`,
      );
    }
  } catch (err) {
    console.error("[recorder-worker] Prune failed:", err);
  }
}

function deleteSessionMeta(sessionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not open"));
    const tx = db.transaction(META_STORE_NAME, "readwrite");
    tx.objectStore(META_STORE_NAME).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("Meta delete failed: " + tx.error?.message));
  });
}

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

    tx.oncomplete = () => {
      deleteSessionMeta(sessionId)
        .catch(() => {})
        .finally(() => resolve());
    };
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
        if (currentSessionId) {
          await touchSessionMeta(currentSessionId);
        }
        self.postMessage({ type: "ready" });
        // Reclaim storage from sessions abandoned long ago. Deliberately after
        // "ready" so it never delays the first chunks of this session.
        pruneExpiredSessions(currentSessionId);
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

    // Explicit release, sent only once the caller no longer needs the audio
    // (upload confirmed, or the session was discarded on purpose). Never sent
    // on unmount — see use-conversation-recorder.
    case "cleanup": {
      const target: string | null = event.data.sessionId ?? currentSessionId;
      if (db && target) {
        await cleanupSession(target).catch(console.error);
        // Stop pointing at a session that no longer exists. A late chunk would
        // otherwise be filed under it and, because its meta row is gone too,
        // become an orphan the age-based prune can never see.
        if (target === currentSessionId) {
          currentSessionId = null;
        }
      }
      break;
    }

    default:
      console.warn("[recorder-worker] Unknown message type:", type);
  }
});
