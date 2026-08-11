"use server";
import {
  COLLECTIONS,
  COST_PER_VOICE_SECOND_IN_CENTS,
  SUMMARIZE_TRANSCRIPT_PROMPT,
} from "@/constants";
import { db } from "@/firebase/admin";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { FieldValue } from "firebase-admin/firestore";

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
  if (!Number.isFinite(seconds) || seconds < 0) {
    console.error("Refusing to bill invalid duration", { sessionId, seconds });
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

      const alreadyBilledSeconds = usageDoc.exists
        ? ((usageDoc.data()?.seconds as number | undefined) ?? 0)
        : 0;

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
 * @returns The session document id, or undefined if finalization failed.
 */
export const recordVoiceSession = async ({
  usage,
}: {
  usage: FirestoreWrite<VoiceSessionUsage, "createdAt">;
}) => {
  try {
    const finalUsage = { ...usage };

    // Fetch temporary buffer to reconstruct complete session state
    if (usage.sessionId) {
      const bufferRef = db
        .collection(COLLECTIONS.VOICE_SESSION_BUFFERS)
        .doc(usage.sessionId);
      const bufferSnap = await bufferRef.get();

      if (bufferSnap.exists) {
        const bufferData = bufferSnap.data() as VoiceSessionBuffer;
        if (bufferData) {
          // Prevent underbilling by taking the max duration
          const clientDuration = usage.duration || 0;
          const bufferDuration = bufferData.duration || 0;
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

          // Overwrite title and summary with complete context
          if (bufferTranscripts.length > 0) {
            const { title, summary } = await summarizeConversation({
              transcripts: finalUsage.transcripts,
              instructor:
                bufferData.preferedVoice.preferedVoiceName || "Evelyn",
              user: bufferData.userName || "User",
            });
            finalUsage.title = title;
            finalUsage.summary = summary;
          }
        }
      }
    }

    // Deterministic id — one document per session, so a replay updates the
    // existing record instead of creating a second one for the same call.
    const voiceSessionRef = usage.sessionId
      ? db.collection(COLLECTIONS.VOICE_SESSIONS).doc(usage.sessionId)
      : db.collection(COLLECTIONS.VOICE_SESSIONS).doc();

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
      const previousTranscripts = Array.isArray(previous.transcripts)
        ? previous.transcripts
        : [];
      const nextTranscripts = Array.isArray(finalUsage.transcripts)
        ? finalUsage.transcripts
        : [];

      const duration = Math.max(previous.duration || 0, finalUsage.duration);

      const merged: Partial<VoiceSessionUsage> = {
        duration,
        cost: Math.max(previous.cost || 0, finalUsage.cost || 0),
        transcripts:
          nextTranscripts.length > previousTranscripts.length
            ? nextTranscripts
            : previousTranscripts,
        title: finalUsage.title || previous.title,
        summary: finalUsage.summary || previous.summary,
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

    // Release the buffer ONLY once the seconds are billed.
    //
    // recordVoiceUsageAndDeduct reports failure instead of throwing, so without
    // this check a failed deduction still dropped the buffer — and the buffer is
    // the only thing the scheduler can retry from. Losing it means nobody ever
    // bills that session. Leaving it in place costs one stale document that the
    // scheduler picks up 15 minutes later and bills idempotently.
    if (usage.sessionId && billing.success) {
      const bufferRef = db
        .collection(COLLECTIONS.VOICE_SESSION_BUFFERS)
        .doc(usage.sessionId);
      await bufferRef.delete().catch((err) => {
        console.error("Failed to delete temporary buffer", err);
      });
    } else if (usage.sessionId) {
      console.error(
        "Billing failed; keeping voice session buffer for scheduler retry",
        usage.sessionId,
      );
    }

    return voiceSessionRef.id;
  } catch (error) {
    console.error("Error recording voice session usage:", error);
  }
};
