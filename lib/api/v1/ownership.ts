import "server-only";
import { COLLECTIONS } from "@/constants";
import { db } from "@/firebase/admin";

/**
 * Confirms a top-level Firestore document belongs to `userId`.
 *
 * Several of the server actions the mobile API wraps take only a resource id and
 * carry no owner check of their own — `getChatMessages`, `updateChatSessionTitle`,
 * `deleteChatSession`, `markAsRead`, `deleteNotification`, `getTicketMessages`,
 * `addTicketMessage`. On the web that is safe: the cookie-authed UI only ever
 * holds ids for the signed-in user, and `firestore.rules` blocks cross-user
 * client reads. But a v1 route runs under the Admin SDK, which bypasses those
 * rules, so wrapping such an action directly would let any authenticated caller
 * read or mutate another user's document just by knowing its id (IDOR). Each of
 * those routes calls this first and treats a `null` result as "not yours".
 *
 * Returns the document data when the doc exists AND its `userId` field matches;
 * otherwise `null`. Callers surface `null` as 404 (never 403) so the endpoint
 * doesn't reveal whether an id it doesn't own actually exists.
 */
export async function verifyDocOwnership(
  collection: string,
  docId: string,
  userId: string,
): Promise<FirebaseFirestore.DocumentData | null> {
  const snap = await db.collection(collection).doc(docId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data || data.userId !== userId) return null;
  return data;
}

/**
 * Verifies that a chat session belongs to the given user.
 * Used as a server-side ownership guard before writing messages or deducting usage,
 * preventing a spoofed x-chat-id header from writing to another user's session.
 * @param sessionId - The chat session ID to verify
 * @param userId - The authenticated user's ID
 * @returns true if the session exists and belongs to the user
 */
export async function verifyChatSessionOwner(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const sessionDoc = await db
      .collection(COLLECTIONS.CHAT_SESSIONS)
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) return false;
    return sessionDoc.data()?.userId === userId;
  } catch (error) {
    console.error("Error verifying chat session owner:", error);
    throw error;
  }
}
