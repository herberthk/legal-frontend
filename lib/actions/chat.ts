"use server";

import { COLLECTIONS } from "@/constants";
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
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc();
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
    isFirstMessage?: boolean; // Only update session title on the first user message
  },
) {
  try {
    const now = new Date().toISOString();
    const result = await db.runTransaction(async (transaction) => {
      const messageRef = db
        .collection(COLLECTIONS.CHAT_SESSIONS)
        .doc(sessionId)
        .collection(COLLECTIONS.MESSAGES)
        .doc();

      transaction.set(messageRef, {
        sessionId,
        role: message.role,
        text: message.text,
        createdAt: now,
        tokenCount: message.tokenCount,
        ...(message.attachment && { attachment: message.attachment }),
      });

      // Update session metadata
      transaction.update(
        db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId),
        {
          updatedAt: now,
          messageCount: FieldValue.increment(1),
          // Only update the session title from the first user message
          ...(message.role === "user" &&
            message.isFirstMessage && {
              title: message.text.slice(0, 100),
            }),
        },
      );

      return { success: true, messageId: messageRef.id };
    });
    return result;
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
      .collection(COLLECTIONS.CHAT_SESSIONS)
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
      .collection(COLLECTIONS.CHAT_SESSIONS)
      .doc(sessionId)
      .collection(COLLECTIONS.MESSAGES)
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

/**
 * Updates the title of a chat session
 */
export const updateChatSessionTitle = async (
  sessionId: string,
  title: string,
) => {
  try {
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId);
    await sessionRef.update({
      title: title.slice(0, 100),
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating chat session title:", error);
    return { success: false };
  }
};

/**
 * Deletes a chat session and all its messages
 */
export const deleteChatSession = async (sessionId: string) => {
  try {
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId);

    // Delete all messages in the subcollection
    const messagesSnapshot = await sessionRef
      .collection(COLLECTIONS.MESSAGES)
      .get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete the session record itself
    batch.delete(sessionRef);

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return { success: false };
  }
};
