import { useCallback, useRef } from "react";
import { db } from "@/firebase/client";
import { COLLECTIONS } from "@/constants";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

interface UseFirebaseSyncOptions {
  sessionId: string;
  userId: string;
  userName: string;
  preferedVoice: PreferedVoice;
  allTranscriptsRef: React.MutableRefObject<Transcript[]>;
}

/**
 * Custom hook to handle syncing voice session transcripts to Firestore buffer.
 */
export function useFirebaseSync({
  sessionId,
  userId,
  userName,
  preferedVoice,
  allTranscriptsRef,
}: UseFirebaseSyncOptions) {
  const isSyncingRef = useRef(false);
  // Track which transcripts are currently being synced to avoid duplicate writes on retry
  const syncingTranscriptsRef = useRef<Transcript[]>([]);

  const syncSessionToBuffer = useCallback(
    async (currentDuration: number) => {
      if (isSyncingRef.current || allTranscriptsRef.current.length === 0)
        return;

      try {
        isSyncingRef.current = true;
        // Snapshot what we're about to sync into a dedicated ref BEFORE the await.
        // This means:
        //   a) New transcripts arriving during the async write go into allTranscriptsRef
        //      and are NOT cleared if this sync fails.
        //   b) We only clear exactly what was successfully committed, preventing duplicates.
        syncingTranscriptsRef.current = [...allTranscriptsRef.current];

        const bufferRef = doc(
          db,
          COLLECTIONS.VOICE_SESSION_BUFFERS,
          sessionId,
        );

        const snapshot = await getDoc(bufferRef);

        if (!snapshot.exists()) {
          await setDoc(bufferRef, {
            sessionId,
            userId,
            userName,
            preferedVoice,
            duration: currentDuration,
            transcripts: syncingTranscriptsRef.current,
            updatedAt: serverTimestamp(),
            status: "active",
          });
        } else {
          // Read existing transcripts and append new ones manually.
          // arrayUnion would silently deduplicate identical objects (e.g. user says
          // "Yes" or "Okay" twice), which causes real data loss for short repeated
          // user turns. Manual concatenation preserves every turn.
          const existingTranscripts = Array.isArray(
            snapshot.data()?.transcripts,
          )
            ? (snapshot.data()!.transcripts as Transcript[])
            : [];
          await updateDoc(bufferRef, {
            transcripts: [
              ...existingTranscripts,
              ...syncingTranscriptsRef.current,
            ],
            duration: currentDuration,
            updatedAt: serverTimestamp(),
          });
        }

        // Only clear the transcripts that were CONFIRMED written.
        // Any transcripts that arrived during the awaits above are safely preserved
        // at the front of allTranscriptsRef.current.
        allTranscriptsRef.current = allTranscriptsRef.current.slice(
          syncingTranscriptsRef.current.length,
        );
        syncingTranscriptsRef.current = [];
      } catch (error) {
        console.error("[gemini-live] Sync failed:", error);
        // On failure, do NOT clear allTranscriptsRef. The in-flight batch
        // is abandoned and will be retried on the next sync tick.
        syncingTranscriptsRef.current = [];
      } finally {
        isSyncingRef.current = false;
      }
    },
    [userId, userName, preferedVoice, sessionId, allTranscriptsRef],
  );

  /**
   * Keep the buffer's `updatedAt` fresh while the call is live.
   *
   * `syncSessionToBuffer` returns early when no new transcripts have arrived,
   * so a long silence — the AI listening, the user reading, a quiet stretch —
   * left `updatedAt` frozen. The scheduler treats a stale buffer as abandoned
   * and finalizes it, which meant a still-running call could be billed and
   * closed out from under itself, then bill again when it really ended.
   *
   * This write is the liveness signal, kept deliberately separate from the
   * transcript sync so the two can't interfere:
   *   • it never writes `transcripts`, so it cannot clobber a concurrent
   *     append or resurrect a batch that failed;
   *   • it uses merge, so it also creates the buffer for a call that has not
   *     produced a single transcript yet — those seconds are real and were
   *     previously lost entirely if the tab died before anyone spoke;
   *   • it defers to an in-flight transcript sync, which already refreshes
   *     `updatedAt` on its own.
   */
  const heartbeatBuffer = useCallback(
    async (currentDuration: number) => {
      if (isSyncingRef.current) return;

      try {
        const bufferRef = doc(db, COLLECTIONS.VOICE_SESSION_BUFFERS, sessionId);
        await setDoc(
          bufferRef,
          {
            sessionId,
            userId,
            userName,
            preferedVoice,
            duration: currentDuration,
            updatedAt: serverTimestamp(),
            status: "active",
          },
          { merge: true },
        );
      } catch (error) {
        // A missed beat is survivable: the next tick tries again, and the
        // scheduler's billing is idempotent if one is ever missed for long
        // enough to look abandoned.
        console.error("[gemini-live] Heartbeat failed:", error);
      }
    },
    [userId, userName, preferedVoice, sessionId],
  );

  return {
    syncSessionToBuffer,
    heartbeatBuffer,
    syncingTranscriptsRef,
    isSyncingRef,
  };
}
