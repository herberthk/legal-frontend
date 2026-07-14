"use server";

import { COLLECTIONS } from "@/constants";
import { db, storageAdmin } from "@/firebase/admin";
import { FieldValue, Timestamp, Query } from "firebase-admin/firestore";

/**
 * Helper to extract the object path from a Firebase Storage download URL.
 */
function extractStoragePathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/([^?]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch (e) {
    console.error("Failed to parse storage URL:", url);
  }
  return null;
}

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
    attachment?: { name: string; contentType: string; url: string };
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
        doc.data()?.createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        doc.data()?.updatedAt?.toDate().toISOString() ||
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
 * @param sessionId - The chat session ID
 * @param limit     - Number of messages per page (default 10)
 * @param cursor    - Cursor object containing ID and timestamp of oldest message
 */
export async function getChatMessages(
  sessionId: string,
  limit = 10,
  cursor?: { id: string; createdAt: string }
) {
  try {
    const collectionRef = db
      .collection(COLLECTIONS.CHAT_SESSIONS)
      .doc(sessionId)
      .collection(COLLECTIONS.MESSAGES);

    let query: Query = collectionRef.orderBy("createdAt", "asc");

    if (cursor) {
      const cursorTime = Timestamp.fromDate(new Date(cursor.createdAt));
      query = query.endBefore(cursorTime);
      // console.log("getting messages with cursor", cursorTime);
    }

    const snapshot = await query.limitToLast(limit + 1).get();

    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(1) : snapshot.docs;

    const messages: ChatMessageRecord[] = docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
      };
    }) as ChatMessageRecord[];

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
 * Deletes a chat session and all its messages.
 * Includes cleaning up any orphaned files in Firebase Storage.
 */
export const deleteChatSession = async (sessionId: string) => {
  try {
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId);

    // 1. Fetch all messages
    const messagesSnapshot = await sessionRef
      .collection(COLLECTIONS.MESSAGES)
      .get();

    // 2. Identify attachments and delete them from Storage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storageDeletions: Promise<any>[] = [];
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
    
    if (bucketName) {
      const bucket = storageAdmin.bucket(bucketName);
      
      messagesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.attachment && data.attachment.url) {
          const objectPath = extractStoragePathFromUrl(data.attachment.url);
          if (objectPath) {
            const file = bucket.file(objectPath);
            // Catch errors so one missing/broken file doesn't block Firestore cleanup
            storageDeletions.push(
              file.delete().catch((err) => {
                console.error(`Failed to delete storage file: ${objectPath}`, err);
              })
            );
          }
        }
      });

      if (storageDeletions.length > 0) {
        // Wait for all storage deletions to finish (pass or fail)
        await Promise.allSettled(storageDeletions);
      }
    } else {
      console.warn("Storage bucket not configured. Skipping attachment cleanup.");
    }

    // 3. Delete messages and session in chunked batches (max 500 ops per batch)
    // Firestore batch limit is 500. We will chunk them into arrays of 450 to be safe.
    const CHUNK_SIZE = 450;
    const docsToDelete = [...messagesSnapshot.docs.map((d) => d.ref), sessionRef];
    
    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
      const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return { success: false };
  }
};
