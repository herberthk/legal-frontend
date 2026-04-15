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
  if (title.length > 50) {
    title = title.substring(0, 47) + "...";
  }

  // 2. Summary: Use AI to summarize the transcript
  const transcriptText = transcripts
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  try {
    const { text: summary } = await generateText({
      model: google("gemini-3.1-flash-lite-preview"),
      system: SUMMARIZE_TRANSCRIPT_PROMPT({
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
 * Deduction order: Welcome Bonus → Daily Free → Paid Balance.
 * Uses a Firestore transaction for atomicity.
 *
 * @param params - Usage parameters
 * @returns Success status and the deducted cost
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

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const user = userDoc.data() as Omit<User, "id">;
      let source: UsageSource = "free";
      let totalCost = 0;

      let balance = user.balance;
      let freeSeconds = user.freeVoiceSeconds;

      if (freeSeconds > 0) {
        // Deduct exclusively from free voice quota first
        freeSeconds = Math.max(0, freeSeconds - seconds);
        source = "free";
      } else {
        // No free seconds left — deduct from paid balance
        const cost = seconds * COST_PER_VOICE_SECOND_IN_CENTS;
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

      // Create usage record
      const usageRef = db.collection(COLLECTIONS.USAGE).doc();
      transaction.set(usageRef, {
        userId,
        type,
        tokens,
        cost: totalCost,
        sessionId,
        seconds,
        source,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { cost: totalCost };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("Error recording usage:", error);
    return { success: false, cost: 0 };
  }
};

/**
 * first check if user has free voice seconds
 * if yes deduct from free voice seconds
 * if no deduct from paid balance
 * create a voice session record
 * update user document
 *
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
        const bufferData = bufferSnap.data();
        if (bufferData) {
          // Prevent underbilling by taking the max duration
          const clientDuration = usage.duration || 0;
          const bufferDuration = bufferData.duration || 0;
          finalUsage.duration = Math.max(clientDuration, bufferDuration);

          if (finalUsage.duration > clientDuration) {
            const { COST_PER_VOICE_SECOND_IN_CENTS } =
              await import("@/constants");
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
            const { summarizeConversation } =
              await import("@/lib/actions/voice-actions");
            const { title, summary } = await summarizeConversation({
              transcripts: finalUsage.transcripts,
              instructor: bufferData.voicePreference || "Zephyr",
              user: bufferData.userName || "User",
            });
            finalUsage.title = title;
            finalUsage.summary = summary;
          }
        }
      }
    }

    const voiceSessionRef = db.collection(COLLECTIONS.VOICE_SESSIONS).doc();
    await voiceSessionRef.set({
      ...finalUsage,
    });

    // record usage and deduct from user balance
    await recordVoiceUsageAndDeduct({
      userId: finalUsage.userId,
      type: "VOICE_SESSION",
      seconds: finalUsage.duration,
      sessionId: finalUsage.sessionId,
    });

    // Send notification to user
    await createNotification(usage.userId, {
      title: "Voice Session Recorded",
      message: "Your voice session has been recorded successfully.",
      type: "SUCCESS",
      url: `/dashboard/user/transcriptions/${voiceSessionRef.id}`,
    });

    // Delete from temporary buffer after successful save
    if (usage.sessionId) {
      const bufferRef = db
        .collection(COLLECTIONS.VOICE_SESSION_BUFFERS)
        .doc(usage.sessionId);
      await bufferRef.delete().catch((err) => {
        console.error("Failed to delete temporary buffer", err);
      });
    }

    return voiceSessionRef.id;
  } catch (error) {
    console.error("Error recording voice session usage:", error);
  }
};
