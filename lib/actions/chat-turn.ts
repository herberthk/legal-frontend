"use server";

import { COLLECTIONS } from "@/constants";
import { db } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

import { isTurnId } from "@/lib/chat-turn";
import { sanitizeChatContent, sanitizeFilename } from "@/lib/security/sanitizer";

/**
 * The server side of one chat turn.
 *
 * A turn is a pair of documents in `chatSessions/{id}/messages`: the user message
 * at `{turnId}` and its answer at `{turnId}-a`. The user document is written
 * before generation starts, so a turn that is interrupted (app killed, network
 * dropped, or stopped by the reader) still exists on the server and can be
 * offered a Continue/Discard choice on the next visit.
 *
 * That single fact is what makes the flow durable:
 *   - the user message exists **and** the answer does not  → pending, resumable;
 *   - both exist                                            → finished; a replay
 *     streams the stored answer and never charges twice;
 *   - the user message is gone                              → the reader
 *     discarded it; nothing is persisted or billed.
 *
 * Every entry point re-checks the session owner, because a turn id is client
 * input and would otherwise be a write primitive against any session.
 *
 * `messageCount` counts documents: one when the pending user row is created, one
 * more when the answer is written, one less when the pending row is cancelled.
 */

export type TurnAttachment = {
  name: string;
  contentType: string;
  url: string;
};

export type ChatTurnUserMessage = {
  turnId: string;
  text: string;
  tokenCount: number;
  attachment?: TurnAttachment;
  isFirstMessage: boolean;
};

function messagesCollection(sessionId: string) {
  return db
    .collection(COLLECTIONS.CHAT_SESSIONS)
    .doc(sessionId)
    .collection(COLLECTIONS.MESSAGES);
}

function sessionDocument(sessionId: string) {
  return db.collection(COLLECTIONS.CHAT_SESSIONS).doc(sessionId);
}

function tokenCountOf(doc: FirebaseFirestore.DocumentSnapshot): number {
  const value = doc.data()?.tokenCount;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function ownsSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await db
    .collection(COLLECTIONS.CHAT_SESSIONS)
    .doc(sessionId)
    .get();
  return session.exists && session.data()?.userId === userId;
}

/**
 * Registers the turn before generation.
 *
 * The user document is written first and is the marker that a turn is pending;
 * the answer document decides whether it is finished. When both exist the caller
 * is told to replay rather than ask the model again, so a retried request after a
 * lost response costs nothing.
 */
export type TurnReplayEntry = {
  role: "user" | "assistant";
  text: string;
};

export type BeginChatTurnOptions = {
  /**
   * Create the pending row when it does not exist.
   *
   * Follow-up turns arrive without a `POST /chats` write, so the first call must
   * create the row. A first turn was already written together with its session,
   * so a missing row means the reader discarded it. The update pass after token
   * estimation always runs with this off, which is what lets a discard that
   * landed mid-estimation win.
   */
  createIfMissing?: boolean;
};

export async function beginChatTurn(
  sessionId: string,
  userId: string,
  message: ChatTurnUserMessage,
  { createIfMissing = false }: BeginChatTurnOptions = {},
): Promise<{
  status: "started" | "replay" | "cancelled" | "denied";
  isFirstMessage?: boolean;
  replay?: TurnReplayEntry[];
  /** Tokens the stored pair represents, so a replay can settle an unpaid turn. */
  replayTokens?: number;
}> {
  if (!isTurnId(message.turnId)) return { status: "denied" };
  try {
    if (!(await ownsSession(sessionId, userId))) return { status: "denied" };

    const userRef = messagesCollection(sessionId).doc(message.turnId);
    const answerRef = messagesCollection(sessionId).doc(`${message.turnId}-a`);

    return await db.runTransaction(async (transaction) => {
      const [userDoc, answerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(answerRef),
      ]);

      const read = (
        doc: FirebaseFirestore.DocumentSnapshot,
        role: "user" | "assistant",
      ): TurnReplayEntry => {
        const data = doc.data() ?? {};
        return {
          role,
          text: typeof data.text === "string" ? data.text : "",
        };
      };

      if (answerDoc.exists) {
        return {
          status: "replay",
          replay: userDoc.exists
            ? [read(userDoc, "user"), read(answerDoc, "assistant")]
            : [read(answerDoc, "assistant")],
          replayTokens: tokenCountOf(userDoc) + tokenCountOf(answerDoc),
        };
      }

      const attachment = message.attachment && {
        name: sanitizeFilename(message.attachment.name || "document"),
        contentType: message.attachment.contentType,
        url: message.attachment.url,
      };

      if (!userDoc.exists) {
        if (!createIfMissing) {
          // The reader discarded this turn while the client still held it.
          return { status: "cancelled" };
        }

        transaction.set(userRef, {
          sessionId,
          role: "user",
          text: sanitizeChatContent(message.text),
          createdAt: FieldValue.serverTimestamp(),
          tokenCount: message.tokenCount,
          ...(attachment && { attachment }),
        });
        // The pending row is one document, so it counts as one message now. The
        // answer adds the second half in `completeChatTurn`.
        transaction.update(sessionDocument(sessionId), {
          updatedAt: FieldValue.serverTimestamp(),
          messageCount: FieldValue.increment(1),
        });

        return { status: "started", isFirstMessage: message.isFirstMessage };
      }

      transaction.set(
        userRef,
        {
          sessionId,
          role: "user",
          text: sanitizeChatContent(message.text),
          tokenCount: message.tokenCount,
          ...(attachment && { attachment }),
        },
        { merge: true },
      );

      return { status: "started", isFirstMessage: message.isFirstMessage };
    });
  } catch (error) {
    console.error("Error beginning chat turn:", error);
    return { status: "denied" };
  }
}

/**
 * Writes the finished answer and marks the turn complete.
 *
 * The user document is re-read inside the transaction: a discard that lands while
 * the answer was streaming must win, otherwise a stopped turn would reappear in
 * history on the next load. `messageCount` moves by one (the answer document),
 * because the question was counted when its pending row was created.
 */
export async function completeChatTurn(
  sessionId: string,
  userId: string,
  params: {
    turnId: string;
    answer: string;
    answerTokens: number;
    userTokens: number;
    title?: string;
  },
): Promise<{ success: boolean; text?: string }> {
  if (!isTurnId(params.turnId)) return { success: false };
  try {
    if (!(await ownsSession(sessionId, userId))) return { success: false };

    const userRef = messagesCollection(sessionId).doc(params.turnId);
    const answerRef = messagesCollection(sessionId).doc(`${params.turnId}-a`);

    const result = await db.runTransaction(async (transaction) => {
      const [userDoc, answerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(answerRef),
      ]);

      if (!userDoc.exists) return { success: false as const };
      if (answerDoc.exists) {
        // The answer was already committed; a retry must not rewrite it.
        return {
          success: true as const,
          text: answerDoc.data()?.text as string | undefined,
        };
      }

      const answer = sanitizeChatContent(params.answer);
      transaction.set(answerRef, {
        sessionId,
        role: "assistant",
        text: answer,
        createdAt: FieldValue.serverTimestamp(),
        tokenCount: params.answerTokens,
      });

      transaction.update(userRef, { tokenCount: params.userTokens });

      transaction.update(sessionDocument(sessionId), {
        updatedAt: FieldValue.serverTimestamp(),
        messageCount: FieldValue.increment(1),
        ...(params.title ? { title: params.title.slice(0, 100) } : {}),
      });

      return { success: true as const, text: answer };
    });

    return result;
  } catch (error) {
    console.error("Error completing chat turn:", error);
    return { success: false };
  }
}

/**
 * Creates a session together with its first pending turn.
 *
 * The session and the user message are one batch, so a question can never be
 * written into a session that does not exist. The turn is completed later by the
 * streaming route (or discarded by its cancel route) — nothing is billed here.
 */
export async function createChatSessionWithTurn(
  userId: string,
  title: string,
  message: ChatTurnUserMessage,
): Promise<{ success: boolean; sessionId: string | null }> {
  if (!isTurnId(message.turnId)) return { success: false, sessionId: null };
  try {
    const sessionRef = db.collection(COLLECTIONS.CHAT_SESSIONS).doc();
    const userRef = sessionRef
      .collection(COLLECTIONS.MESSAGES)
      .doc(message.turnId);

    const batch = db.batch();
    batch.set(sessionRef, {
      userId,
      title: title.slice(0, 200),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      messageCount: 1,
    });
    batch.set(userRef, {
      sessionId: sessionRef.id,
      role: "user",
      text: sanitizeChatContent(message.text),
      createdAt: FieldValue.serverTimestamp(),
      tokenCount: message.tokenCount,
      ...(message.attachment && {
        attachment: {
          name: sanitizeFilename(message.attachment.name || "document"),
          contentType: message.attachment.contentType,
          url: message.attachment.url,
        },
      }),
    });

    await batch.commit();
    return { success: true, sessionId: sessionRef.id };
  } catch (error) {
    console.error("Error creating chat session with turn:", error);
    return { success: false, sessionId: null };
  }
}

/**
 * Deletes a turn that never received an answer.
 *
 * Only the user document is removed, and only when no answer exists: a stop that
 * races with the server finishing must not erase a paid answer. The session's
 * `messageCount` is corrected when the delete actually happened.
 */
export async function cancelChatTurn(
  sessionId: string,
  userId: string,
  turnId: string,
): Promise<{ success: boolean; cancelled: boolean }> {
  if (!isTurnId(turnId)) return { success: false, cancelled: false };
  try {
    if (!(await ownsSession(sessionId, userId))) {
      return { success: false, cancelled: false };
    }

    const userRef = messagesCollection(sessionId).doc(turnId);
    const answerRef = messagesCollection(sessionId).doc(`${turnId}-a`);

    const result = await db.runTransaction(async (transaction) => {
      const [userDoc, answerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(answerRef),
      ]);
      if (!userDoc.exists || answerDoc.exists) {
        return { cancelled: false };
      }

      transaction.delete(userRef);
      transaction.update(sessionDocument(sessionId), {
        messageCount: FieldValue.increment(-1),
      });
      return { cancelled: true };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("Error cancelling chat turn:", error);
    return { success: false, cancelled: false };
  }
}
