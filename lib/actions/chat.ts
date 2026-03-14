"use server";

import { db } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Creates a new chat session in Firestore
 * @param userId - The authenticated user's ID
 * @param title - Initial title for the session (e.g. first message preview)
 * @returns The created session ID
 */
export const createChatSession = async (userId: string, title: string) => {
  try {
    const now = new Date().toISOString();
    const sessionRef = db.collection("chatSessions").doc();
    await sessionRef.set({
      userId,
      title: title.slice(0, 100), // Truncate to 100 chars
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    });

    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error("Error creating chat session:", error);
    return { success: false, sessionId: null };
  }
};

/**
 * Saves a chat message to a session's subcollection
 * @param sessionId - The chat session ID
 * @param message - The message data to save
 */
export async function saveChatMessage(
  sessionId: string,
  message: {
    role: "user" | "assistant";
    text: string;
    tokenCount: number;
    attachment?: { name: string; type: string; url: string };
  },
) {
  try {
    const now = new Date().toISOString();
    const messageRef = db
      .collection("chatSessions")
      .doc(sessionId)
      .collection("messages")
      .doc();

    await messageRef.set({
      sessionId,
      role: message.role,
      text: message.text,
      createdAt: now,
      tokenCount: message.tokenCount,
      ...(message.attachment && { attachment: message.attachment }),
    });

    // Update session metadata
    await db
      .collection("chatSessions")
      .doc(sessionId)
      .update({
        updatedAt: now,
        messageCount: FieldValue.increment(1),
        // Update title from first user message if it's the first message
        ...(message.role === "user" && {
          title: message.text.slice(0, 100),
        }),
      });

    return { success: true, messageId: messageRef.id };
  } catch (error) {
    console.error("Error saving chat message:", error);
    return { success: false, messageId: null };
  }
}

/**
 * Gets all chat sessions for a user, ordered by most recent
 * @param userId - The authenticated user's ID
 * @param limit - Max sessions to return (default 20)
 */
export async function getChatSessions(userId: string, limit = 20) {
  try {
    const snapshot = await db
      .collection("chatSessions")
      .where("userId", "==", userId)
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .get();

    const sessions: ChatSession[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatSession[];

    return { success: true, sessions };
  } catch (error) {
    console.error("Error getting chat sessions:", error);
    return { success: true, sessions: [] };
  }
}

/**
 * Gets messages for a specific chat session
 * @param sessionId - The chat session ID
 */
export async function getChatMessages(sessionId: string) {
  try {
    const snapshot = await db
      .collection("chatSessions")
      .doc(sessionId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const messages: ChatMessageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessageRecord[];

    return { success: true, messages };
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return { success: true, messages: [] };
  }
}

/**
 * Save chat session
 */

export const saveChatSession = async ({
  sessionId,
  text,
  tokenCount,
}: {
  sessionId: string;
  text: string;
  tokenCount: number;
}) => {
  try {
    const result = await db.runTransaction(async (transaction) => {
      const msgRef = db
        .collection("chatSessions")
        .doc(sessionId)
        .collection("messages")
        .doc();

      transaction.set(msgRef, {
        sessionId,
        role: "assistant",
        text,
        createdAt: new Date().toISOString(),
        tokenCount: tokenCount ?? 0,
      });

      const { FieldValue } = await import("firebase-admin/firestore");
      transaction.update(db.collection("chatSessions").doc(sessionId), {
        updatedAt: new Date().toISOString(),
        messageCount: FieldValue.increment(1),
      });
    });
    return result;
  } catch (error) {
    console.error("Error saving chat session:", error);
    return { success: false, title: null };
  }
};
