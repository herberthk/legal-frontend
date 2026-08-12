"use server";
import {
  COLLECTIONS,
  COST_PER_VOICE_SECOND_IN_CENTS,
  MAX_VOICE_SESSION_SECONDS,
  SUMMARIZE_TRANSCRIPT_PROMPT,
} from "@/constants";
import { db } from "@/firebase/admin";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * The voice-duration contract, shared by every writer of a billable duration.
 *
 * A duration reaches billing from three sources: the API route (which validates
 * its own body), the buffer document (which is written by the browser and
 * validated by nothing — `firestore.rules` gates `voiceSessionBuffers` on
 * ownership only, never on field values, and Firestore accepts NaN as a
 * perfectly good double), and an existing session document (which may carry a
 * value written before any of these checks existed).
 *
 * `Math.max` filters none of that: `Math.max(NaN, 42)` is NaN, and one NaN
 * written into a balance subtraction produces a balance the user can never
 * spend down. So every value is funnelled through here before it can be
 * compared, persisted or billed: a finite whole number of seconds, clamped to
 * the same ceiling the route enforces. Anything else is not a duration and
 * becomes 0.
 */
const normalizeDurationSeconds = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), MAX_VOICE_SESSION_SECONDS);
};

/**
 * Same idea for money in cents. Only needed for values read back out of
 * Firestore — a NaN cost merged forward would render as NaN in the dashboard
 * forever, since the merge keeps the larger of the two.
 */
const normalizeCostCents = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/**
 * A sessionId is a document id, not a capability. This is thrown when one
 * resolves to a buffer or a session document owned by somebody else: retrying
 * cannot fix it, so it is kept distinct from transient Firestore failures that
 * the scheduler should pick up again.
 */
class SessionOwnershipError extends Error {}

/**
 * Whether a buffer document is still the exact revision that was read.
 *
 * Both sides undefined means a legacy buffer with no `updatedAt` that has not
 * been touched — that still counts as unchanged. One side missing does not.
 */
const sameBufferRevision = (
  a: Timestamp | undefined,
  b: Timestamp | undefined,
): boolean => {
  if (a instanceof Timestamp && b instanceof Timestamp) {
    return a.isEqual(b);
  }
  return a === b;
};

const isValidSummary = (summary: string | undefined): boolean =>
  Boolean(
    summary &&
      summary.trim() !== "" &&
      summary !== "Summary generation failed.",
  );

const isValidTitle = (title: string | undefined): boolean =>
  Boolean(title && title.trim() !== "");

type RecordVoiceSessionResult =
  | { success: true; voiceSessionId: string }
  | { success: false; retryable: boolean; error: string };

/**
 * Generates a title and summary from a conversation transcript.
 * Title is derived from the second user message.
 */

export const summarizeConversation = async ({
  transcripts,
  instructor,
  user,
}: {
  transcripts: Transcript[];
  instructor: string;
  user: string;
}): Promise<{ title: string; summary: string }> => {
  if (!transcripts || transcripts.length === 0) {
    return {
      title: "Untitled Consultation",
      summary: "No conversation content recorded.",
    };
  }

  // 1. Title: Content of the first user message (if available)
  const userMessages = transcripts.filter((t) => t.role === "user");
  let title = "New Consultation";
  if (userMessages.length >= 1) {
    title = userMessages[0]!.content;
  }

  // Trim title if too long
  // if (title.length > 50) {
  //   title = title.substring(0, 47) + "...";
  // }

  // 2. Summary: Use AI to summarize the transcript
  const transcriptText = transcripts
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  try {
    const { text: summary } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      instructions: SUMMARIZE_TRANSCRIPT_PROMPT({
        user,
        instructor,
      }),
      prompt: `Transcript:\n${transcriptText}`,
    });

    return { title, summary: summary.trim() };
  } catch (error) {
    console.error("Summarization failed:", error);
    return { title, summary: "Summary generation failed." };
  }
};

/**
 * Creates a new notification for a user after successful voice session.
 */
export async function createNotification(
  userId: string,
  data: {
    title: string;
    message: string;
    type: NotificationType;
    url?: string;
  },
) {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc();
    const notification: FirestoreWrite<AppNotification, "createdAt"> = {
      id: notificationRef.id,
      userId,
      ...data,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    await notificationRef.set(notification);

    return { success: true, id: notificationRef.id };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}

/**
 * Records a usage entry and deducts from the correct billing tier.
 * Deduction order: Free voice seconds → Paid Balance.
 * Uses a Firestore transaction for atomicity.
 *
 * ── Idempotent and monotonic ────────────────────────────────────────────────
 * A single session can be finalized more than once: the client bills at the
 * end of a call, an unload beacon bills when the tab dies mid-finalization,
 * and the scheduler cloud function bills abandoned buffers. All three race.
 *
 * The usage record is therefore keyed by `sessionId` (one doc per session,
 * never a random id) and each call bills only the seconds not already billed:
 *   • first write for a session  → bills `seconds`
 *   • a later write with the same or fewer seconds → bills nothing
 *   • a later write with more seconds (buffer caught a longer duration)
 *     → bills only the difference
 * so replays are free and the user is never charged twice for the same audio.
 *
 * @param params - Usage parameters
 * @returns Success status, the cost deducted by THIS call, and the total
 *          seconds now billed for the session.
 */
export const recordVoiceUsageAndDeduct = async (params: {
  userId: string;
  type?: "TEXT_RESPONSE" | "VOICE_SESSION";
  tokens?: number;
  sessionId: string;
  seconds: number;
}) => {
  const {
    userId,
    type = "VOICE_SESSION",
    tokens = 0,
    sessionId,
    seconds,
  } = params;

  // Last line of defence for the balance arithmetic. Every arm below feeds
  // `seconds` into a subtraction against the user's balance, and NaN/Infinity
  // propagate silently through Math.max — a single bad value writes a balance
  // that can never be spent down. Callers validate their own inputs; this makes
  // it impossible for a new caller to skip that and corrupt an account.
  //
  // Number.isInteger rejects NaN, Infinity and fractions in one check: the
  // deduction is per whole second, so a fractional value would also leave
  // sub-cent dust the idempotency comparison below can never settle. The upper
  // bound is the same ceiling the API route enforces, applied here so it holds
  // for the buffer and scheduler paths too — billing is monotonic, and an
  // inflated duration cannot be walked back by a later honest call.
  if (
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > MAX_VOICE_SESSION_SECONDS
  ) {
    console.error("Refusing to bill invalid duration", {
      userId,
      sessionId,
      seconds,
    });
    return { success: false, cost: 0, billedSeconds: 0, alreadyBilled: false };
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      // Deterministic id — the session IS the key, so concurrent finalizers
      // contend on one document instead of each creating their own.
      const usageRef = db.collection(COLLECTIONS.USAGE).doc(sessionId);

      const [userDoc, usageDoc] = await transaction.getAll(userRef, usageRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      // Sanitized on read, not trusted: this document may hold a value written
      // before the guard above existed. A NaN here would make every future
      // `seconds - alreadyBilledSeconds` NaN — never zero, never positive — so
      // the session could neither settle nor be recognised as settled.
      const alreadyBilledSeconds = normalizeDurationSeconds(
        usageDoc.data()?.seconds,
      );

      // Only the seconds nobody has billed yet.
      const billableSeconds = Math.max(0, seconds - alreadyBilledSeconds);

      if (billableSeconds === 0) {
        return {
          cost: 0,
          billedSeconds: alreadyBilledSeconds,
          alreadyBilled: true,
        };
      }

      const user = userDoc.data() as Omit<User, "id">;
      let source: UsageSource = "free";
      let totalCost = 0;

      let balance = user.balance;
      let freeSeconds = user.freeVoiceSeconds;

      if (freeSeconds > 0) {
        if (freeSeconds >= billableSeconds) {
          // Fully covered by free seconds
          freeSeconds = freeSeconds - billableSeconds;
          source = "free";
        } else {
          // Partially covered by free seconds, remaining billed to balance
          const remainingPaidSeconds = billableSeconds - freeSeconds;
          freeSeconds = 0;
          const cost = remainingPaidSeconds * COST_PER_VOICE_SECOND_IN_CENTS;
          balance = Math.max(0, balance - cost);
          totalCost = cost;
          source = "paid";
        }
      } else {
        // No free seconds left — fully billed to paid balance
        const cost = billableSeconds * COST_PER_VOICE_SECOND_IN_CENTS;
        balance = Math.max(0, balance - cost);
        totalCost = cost;
        source = "paid";
      }

      // Update user document
      transaction.update(userRef, {
        balance,
        freeVoiceSeconds: freeSeconds,
        totalSpent: (user.totalSpent || 0) + totalCost,
      });

      // Usage record: created on the first pass, topped up on later ones so it
      // always reflects the full session rather than the last increment.
      const previousCost = usageDoc.exists
        ? ((usageDoc.data()?.cost as number | undefined) ?? 0)
        : 0;
      const previousTokens = usageDoc.exists
        ? ((usageDoc.data()?.tokens as number | undefined) ?? 0)
        : 0;

      transaction.set(
        usageRef,
        {
          userId,
          type,
          tokens: previousTokens + tokens,
          cost: previousCost + totalCost,
          sessionId,
          seconds,
          source,
          ...(usageDoc.exists
            ? { updatedAt: FieldValue.serverTimestamp() }
            : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );

      return { cost: totalCost, billedSeconds: seconds, alreadyBilled: false };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("Error recording usage:", error);
    return { success: false, cost: 0, billedSeconds: 0, alreadyBilled: false };
  }
};

/**
 * Finalizes a voice session: reconstructs the complete session from the
 * temporary buffer, writes the session document, bills the user, and releases
 * the buffer.
 *
 * ── Safe to run more than once ──────────────────────────────────────────────
 * Three independent actors finalize sessions and they can overlap: the client
 * after a call, the unload beacon when the tab dies mid-finalization, and the
 * scheduler cloud function for abandoned buffers. So:
 *   • the session document id is derived from `sessionId`, not random, and is
 *     written with merge — a replay updates one document instead of creating a
 *     second one;
 *   • an existing document's longer duration is preserved (whoever saw more
 *     audio wins), and its transcripts are kept if the replay has fewer;
 *   • billing is idempotent and monotonic (see recordVoiceUsageAndDeduct);
 *   • `audioUrl` is never blanked by a later pass that has no audio.
 *
 * `usage.userId` MUST be the uid the caller authenticated as, never a value from
 * a request body: it is what the buffer and any existing session document are
 * checked against, and what the seconds are billed to.
 *
 * @returns `{ success: true, voiceSessionId }` only when the seconds are
 *          actually billed. A failure carries `retryable`, which says whether
 *          the buffer was left in place for the scheduler to settle later.
 */
export const recordVoiceSession = async ({
  usage,
}: {
  usage: FirestoreWrite<VoiceSessionUsage, "createdAt">;
}): Promise<RecordVoiceSessionResult> => {
  try {
    // Normalized once, up front. Every comparison below is against this value
    // and the cost is derived from it, so an out-of-contract duration cannot
    // reach the session document or the deduction.
    const finalUsage = {
      ...usage,
      duration: normalizeDurationSeconds(usage.duration),
    };
    finalUsage.cost = finalUsage.duration * COST_PER_VOICE_SECOND_IN_CENTS;

    // Deterministic id — one document per session, so a replay updates the
    // existing record instead of creating a second one for the same call.
    const voiceSessionRef = usage.sessionId
      ? db.collection(COLLECTIONS.VOICE_SESSIONS).doc(usage.sessionId)
      : db.collection(COLLECTIONS.VOICE_SESSIONS).doc();

    // Check if an existing session document is available to reuse metadata & verify ownership
    let existingData: VoiceSessionUsage | undefined;
    if (usage.sessionId) {
      const snap = await voiceSessionRef.get();
      if (snap.exists) {
        existingData = snap.data() as VoiceSessionUsage;
        if (existingData.userId !== usage.userId) {
          throw new SessionOwnershipError(
            "voice session document belongs to another user",
          );
        }
      }
    }

    // Populate title/summary from existing session document if available
    if (!isValidTitle(finalUsage.title) && isValidTitle(existingData?.title)) {
      finalUsage.title = existingData!.title;
    }
    if (
      !isValidSummary(finalUsage.summary) &&
      isValidSummary(existingData?.summary)
    ) {
      finalUsage.summary = existingData!.summary;
    }

    // Whether the buffer existed when it was read, and which revision it was
    // at. The release at the bottom needs both: a Gemini summarization call sits
    // between the read and the delete — seconds, not microseconds — and the
    // buffer is the only thing the scheduler can retry from.
    let bufferExisted = false;
    let bufferRevision: Timestamp | undefined;
    let instructorName = "Evelyn";
    let userName = "User";

    // Fetch temporary buffer to reconstruct complete session state
    if (usage.sessionId) {
      const bufferRef = db
        .collection(COLLECTIONS.VOICE_SESSION_BUFFERS)
        .doc(usage.sessionId);
      const bufferSnap = await bufferRef.get();

      if (bufferSnap.exists) {
        const bufferData = bufferSnap.data() as VoiceSessionBuffer | undefined;
        if (bufferData) {
          // A sessionId arrives in a request body, so holding one proves nothing
          // about owning the session behind it. Verified against the uid the
          // caller authenticated as before a single field is read: otherwise
          // another account's transcripts are merged into this session, this
          // user is billed for their seconds, and their buffer is deleted at the
          // bottom of this function. A buffer with no userId cannot be
          // attributed and is treated the same way.
          if (bufferData.userId !== usage.userId) {
            throw new SessionOwnershipError(
              "voice session buffer belongs to another user",
            );
          }

          bufferExisted = true;
          // Read off the snapshot rather than the typed field: VoiceSessionBuffer
          // declares the client SDK's Timestamp because the browser writes it,
          // while this runs under the Admin SDK and has to compare admin ones.
          const revision: unknown = bufferSnap.get("updatedAt");
          bufferRevision =
            revision instanceof Timestamp ? revision : undefined;
          const bufferInstructorName =
            bufferData.preferedVoice?.preferedVoiceName;
          instructorName = isValidTitle(bufferInstructorName)
            ? bufferInstructorName
            : "Evelyn";
          userName = isValidTitle(bufferData.userName)
            ? bufferData.userName
            : "User";

          // Prevent underbilling by taking the max duration. Both sides go
          // through the contract first — the buffer's duration is written by the
          // browser and never passed through the route's validation, so this is
          // the only thing standing between a hand-edited buffer and the
          // balance arithmetic.
          const clientDuration = finalUsage.duration;
          const bufferDuration = normalizeDurationSeconds(bufferData.duration);
          finalUsage.duration = Math.max(clientDuration, bufferDuration);

          if (finalUsage.duration > clientDuration) {
            finalUsage.cost =
              finalUsage.duration * COST_PER_VOICE_SECOND_IN_CENTS;
          }

          // Merge transcripts because the client clears them from memory after every sync
          const bufferTranscripts = Array.isArray(bufferData.transcripts)
            ? bufferData.transcripts
            : [];
          const clientTranscripts = Array.isArray(usage.transcripts)
            ? usage.transcripts
            : [];
          finalUsage.transcripts = [...bufferTranscripts, ...clientTranscripts];
        }
      }
    }

    // Only summarize if title or summary are still missing/invalid after checking existing metadata
    if (
      !isValidTitle(finalUsage.title) ||
      !isValidSummary(finalUsage.summary)
    ) {
      if (finalUsage.transcripts.length > 0) {
        const { title, summary } = await summarizeConversation({
          transcripts: finalUsage.transcripts,
          instructor: instructorName,
          user: userName,
        });

        if (!isValidTitle(finalUsage.title) && isValidTitle(title)) {
          finalUsage.title = title;
        }
        if (!isValidSummary(finalUsage.summary) && isValidSummary(summary)) {
          finalUsage.summary = summary;
        }
      }
    }

    // Fallbacks if summarization yielded invalid/empty results
    if (!isValidTitle(finalUsage.title)) {
      finalUsage.title = isValidTitle(existingData?.title)
        ? existingData!.title
        : "Untitled Consultation";
    }
    if (!isValidSummary(finalUsage.summary)) {
      finalUsage.summary = isValidSummary(existingData?.summary)
        ? existingData!.summary
        : "No conversation content recorded.";
    }

    // The transaction returns the duration the record now carries, which is the
    // figure we bill: if an earlier finalizer saw more audio than this pass, the
    // longer duration is what the user actually used.
    const effectiveDuration = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(voiceSessionRef);

      if (!existing.exists) {
        transaction.set(voiceSessionRef, { ...finalUsage });
        return finalUsage.duration;
      }

      // Another finalizer got here first. Merge so the record only ever gains
      // detail: longest duration wins, richest transcript set wins, and an
      // audioUrl already uploaded is never blanked by a pass that has no audio.
      const previous = existing.data() as VoiceSessionUsage;

      // Same ownership rule as the buffer, one layer down: this document is
      // about to be overwritten and its duration is about to be billed to
      // `usage.userId`. If it belongs to somebody else, the sessionId is not
      // ours to finalize.
      if (previous.userId !== usage.userId) {
        throw new SessionOwnershipError(
          "voice session document belongs to another user",
        );
      }

      const previousTranscripts = Array.isArray(previous.transcripts)
        ? previous.transcripts
        : [];
      const nextTranscripts = Array.isArray(finalUsage.transcripts)
        ? finalUsage.transcripts
        : [];

      // Normalized on read as well: this document may predate the contract, and
      // whatever comes out of this Math.max is the number that gets billed.
      const duration = Math.max(
        normalizeDurationSeconds(previous.duration),
        finalUsage.duration,
      );

      const merged: Partial<VoiceSessionUsage> = {
        duration,
        cost: Math.max(normalizeCostCents(previous.cost), finalUsage.cost || 0),
        transcripts:
          nextTranscripts.length > previousTranscripts.length
            ? nextTranscripts
            : previousTranscripts,
        title: isValidTitle(finalUsage.title)
          ? finalUsage.title
          : isValidTitle(previous.title)
          ? previous.title
          : "Untitled Consultation",
        summary: isValidSummary(finalUsage.summary)
          ? finalUsage.summary
          : isValidSummary(previous.summary)
          ? previous.summary
          : "No conversation content recorded.",
      };

      // Carry audio forward only when this pass actually has some.
      if (finalUsage.audioUrl) {
        merged.audioUrl = finalUsage.audioUrl;
      }

      // No createdAt here — the original creation time is preserved.
      transaction.set(voiceSessionRef, merged, { merge: true });
      return duration;
    });

    // Record usage and deduct from user balance. Idempotent and monotonic, so a
    // replay charges only the seconds nobody has billed yet.
    const billing = await recordVoiceUsageAndDeduct({
      userId: finalUsage.userId,
      type: "VOICE_SESSION",
      seconds: effectiveDuration,
      sessionId: finalUsage.sessionId,
    });

    // Send notification to user (this is handled in the firebase serverless cloud function)
    // await createNotification(usage.userId, {
    //   title: "Voice Session Recorded",
    //   message: "Your voice session has been recorded successfully.",
    //   type: "SUCCESS",
    //   url: `/dashboard/transcripts/${voiceSessionRef.id}`,
    // });

    // A written session document is not a billed session. recordVoiceUsageAndDeduct
    // reports failure instead of throwing, so returning the document id here
    // would tell the caller "settled" — and the client acts on that literally:
    // it marks billing settled and clears the sessionStorage state that arms its
    // unload beacon, so the one actor that would have retried stands down.
    //
    // The buffer is deliberately left untouched on this path. It is the only
    // thing the scheduler can retry from; it costs one stale document, picked up
    // 15 minutes later and billed idempotently.
    if (!billing.success) {
      console.error("Billing failed; keeping voice session buffer for retry", {
        userId: usage.userId,
        sessionId: usage.sessionId,
        seconds: effectiveDuration,
      });
      return {
        success: false,
        retryable: true,
        error: "Failed to bill voice session",
      };
    }

    // Release the buffer, but only the exact revision that was just billed.
    //
    // Everything above — the buffer read, a Gemini summarization call, two
    // Firestore transactions — takes seconds, and the call may still be live and
    // syncing into that buffer the whole time. An unconditional delete throws
    // away whatever arrived in that window: those seconds were never billed, and
    // with the buffer gone nothing can ever bill them.
    if (bufferExisted && usage.sessionId) {
      const bufferRef = db
        .collection(COLLECTIONS.VOICE_SESSION_BUFFERS)
        .doc(usage.sessionId);

      try {
        await db.runTransaction(async (transaction) => {
          const current = await transaction.get(bufferRef);
          if (!current.exists) return; // another finalizer already released it

          const currentRaw: unknown = current.get("updatedAt");
          const currentRevision =
            currentRaw instanceof Timestamp ? currentRaw : undefined;

          if (!sameBufferRevision(currentRevision, bufferRevision)) {
            // The buffer moved on: it now holds seconds or transcripts that were
            // not part of this settlement. Keep it so the scheduler finalizes
            // the remainder — the deduction is monotonic, so that retry charges
            // only the difference.
            console.warn(
              "Voice session buffer changed during finalization; keeping it for retry",
              usage.sessionId,
            );
            return;
          }

          transaction.delete(bufferRef);
        });
      } catch (err) {
        console.error("Failed to delete temporary buffer", err);
      }
    }

    return { success: true, voiceSessionId: voiceSessionRef.id };
  } catch (error) {
    // A foreign sessionId is not a transient fault — no amount of retrying makes
    // the session ours, and the buffer must be left alone because it is somebody
    // else's document.
    if (error instanceof SessionOwnershipError) {
      console.error("Refusing to finalize voice session:", error.message, {
        userId: usage.userId,
        sessionId: usage.sessionId,
      });
      return { success: false, retryable: false, error: error.message };
    }

    console.error("Error recording voice session usage:", error);
    return {
      success: false,
      retryable: true,
      error: "Failed to record voice session",
    };
  }
};
