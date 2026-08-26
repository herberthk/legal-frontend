import "server-only";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { getFCMTokenDocId } from "@/lib/fcm-utils";

/**
 * Uid-parameterized core of FCM device-token storage.
 *
 * `userId` is REQUIRED and treated as already trusted — the caller proves
 * identity first:
 *   - web    → `saveFCMToken` / `removeFCMToken` in `lib/actions/notifications.ts`
 *              resolve the `session` cookie and pass the verified uid down.
 *   - mobile → `app/api/v1/notifications/register-device` and
 *              `.../notifications/device` pass `gate.userId`, verified from the
 *              Firebase ID token by `requireMobileAuth`.
 *
 * Deliberately NOT a `"use server"` file. If a browser could call these with an
 * arbitrary `userId`, an attacker could register their own device token under a
 * victim's uid and receive that victim's push notifications.
 */

/** Upserts a device's FCM registration token for `userId`. */
export async function saveFCMTokenFor(userId: string, token: string) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };
    if (!token) return { success: false, error: "Missing token" };

    const docId = getFCMTokenDocId(token);
    await db.collection(COLLECTIONS.FCM_TOKENS).doc(docId).set({
      userId,
      token,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("[FCM] Error saving token:", error);
    return { success: false, error: "Failed to save token" };
  }
}

/**
 * Removes a stale or revoked FCM registration token belonging to `userId`.
 * Only documents owned by `userId` are deleted, so a caller can never unregister
 * another account's device by guessing its token.
 */
export async function removeFCMTokenFor(userId: string, token: string) {
  try {
    if (!userId) return { success: false, error: "Unauthorized" };
    if (!token) return { success: false, error: "Missing token" };

    const docId = getFCMTokenDocId(token);
    const docRef = db.collection(COLLECTIONS.FCM_TOKENS).doc(docId);

    // Use transaction to ensure atomic read-check-delete
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (docSnap.exists && docSnap.data()?.userId === userId) {
        transaction.delete(docRef);
      }
    });

    // Clean up any duplicates outside the transaction
    const querySnapshot = await db
      .collection(COLLECTIONS.FCM_TOKENS)
      .where("userId", "==", userId)
      .where("token", "==", token)
      .get();

    const deletions: Promise<unknown>[] = [];
    for (const doc of querySnapshot.docs) {
      if (doc.id !== docId) {
        deletions.push(doc.ref.delete());
      }
    }

    const results = await Promise.allSettled(deletions);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("[FCM] Failed to delete duplicate token documents:", failed);
      return { success: false, error: "Failed to remove token" };
    }
    return { success: true };
  } catch (error) {
    console.error("[FCM] Error removing token:", error);
    return { success: false, error: "Failed to remove token" };
  }
}
