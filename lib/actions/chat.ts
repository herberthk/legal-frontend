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
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc();
    await sessionRef.set({
      userId,
      title: title.slice(0, 100), // Truncate to 100 chars
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
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
        createdAt: FieldValue.serverTimestamp(),
        tokenCount: message.tokenCount,
        ...(message.attachment && { attachment: message.attachment }),
      });

      // Update session metadata
      transaction.update(
        db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId),
        {
          updatedAt: FieldValue.serverTimestamp(),
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
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        doc.data().updatedAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as ChatSession[];

    return { success: true, sessions };
  } catch (error) {
    console.error("Error getting chat sessions:", error);
    return { success: true, sessions: [] };
  }
}

/**
 * Gets messages for a specific chat session with cursor-based pagination.
 * @param sessionId      - The chat session ID
 * @param limit          - Number of messages per page (default 10)
 * @param beforeMessageId - Fetch messages that appear BEFORE this message ID
 *                          (used when scrolling up to load older messages)
 */
export async function getChatMessages(
  sessionId: string,
  limit = 10,
  beforeMessageId?: string,
) {
  try {
    const collectionRef = db
      .collection(COLLECTIONS.CHAT_SESSIONS)
      .doc(sessionId)
      .collection(COLLECTIONS.MESSAGES);

    // When paginating backwards we fetch the batch that ends just before the
    // oldest currently-displayed message.
    if (beforeMessageId) {
      const cursorDoc = await collectionRef.doc(beforeMessageId).get();
      if (!cursorDoc.exists) {
        return { success: true, messages: [], hasMore: false };
      }

      // Fetch (limit + 1) so we can detect whether there are even older messages
      const snapshot = await collectionRef
        .orderBy("createdAt", "asc")
        .endBefore(cursorDoc)
        .limitToLast(limit + 1)
        .get();

      const hasMore = snapshot.docs.length > limit;
      const docs = hasMore ? snapshot.docs.slice(1) : snapshot.docs;

      const messages: ChatMessageRecord[] = docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt:
          doc.data().createdAt?.toDate().toISOString() ||
          new Date().toISOString(),
      })) as ChatMessageRecord[];

      return { success: true, messages, hasMore };
    }

    // Initial load: fetch the most-recent `limit` messages in ascending order
    // so we get the tail of the conversation. We request limit+1 to probe for
    // older pages without a second round-trip.
    const snapshot = await collectionRef
      .orderBy("createdAt", "asc")
      .limitToLast(limit + 1)
      .get();

    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(1) : snapshot.docs;

    const messages: ChatMessageRecord[] = docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as ChatMessageRecord[];

    return { success: true, messages, hasMore };
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return { success: true, messages: [], hasMore: false };
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
        createdAt: FieldValue.serverTimestamp(),
        tokenCount: tokenCount ?? 0,
      });

      transaction.update(db.collection("chatSessions").doc(sessionId), {
        updatedAt: FieldValue.serverTimestamp(),
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
      updatedAt: FieldValue.serverTimestamp(),
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
