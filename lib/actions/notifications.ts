"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { saveFCMTokenFor, removeFCMTokenFor } from "@/services/fcm";
import { getAuthenticatedUserId } from "./auth";

/**
 * Creates a new notification for a user.
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
    const notification: FirestoreWrite<
      Omit<AppNotification, "id">,
      "createdAt"
    > = {
      userId,
      ...data,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    await notificationRef.set(notification);
    revalidatePath("/dashboard"); // Revalidate all dashboard paths if needed
    return { success: true, id: notificationRef.id };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}

/**
 * Fetches notifications for a user with pagination and filtering.
 */
export async function getNotifications(
  userId: string,
  options: {
    page?: number;
    pageSize?: number;
    filter?: "ALL" | "UNREAD" | "READ";
  } = {},
) {
  const { page = 1, pageSize = 10, filter = "ALL" } = options;

  try {
    let query = db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("userId", "==", userId);

    if (filter === "UNREAD") {
      query = query.where("isRead", "==", false);
    } else if (filter === "READ") {
      query = query.where("isRead", "==", true);
    }

    // Get total count for pagination
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    const snapshot = await query
      .orderBy("createdAt", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    })) as AppNotification[];

    return {
      success: true,
      notifications,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      success: false,
      notifications: [],
      totalCount: 0,
      totalPages: 0,
    };
  }
}

/**
 * Marks a notification as read.
 */
export async function markAsRead(notificationId: string) {
  try {
    await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .doc(notificationId)
      .update({ isRead: true });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: "Failed to mark as read" };
  }
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking all as read:", error);
    return { success: false, error: "Failed to mark all as read" };
  }
}

/**
 * Marks a notification as unread.
 */
export async function markAsUnread(notificationId: string) {
  try {
    await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .doc(notificationId)
      .update({ isRead: false });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking notification as unread:", error);
    return { success: false, error: "Failed to mark as unread" };
  }
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(notificationId: string) {
  try {
    await db.collection(COLLECTIONS.NOTIFICATIONS).doc(notificationId).delete();

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}

/**
 * Gets the latest five unread notifications for a user.
 */
export const getLatestUnreadNotifications = async (userId: string) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where("userId", "==", userId)
      .where("isRead", "==", false)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    return {
      success: true,
      notifications: snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt:
          doc.data().createdAt?.toDate().toISOString() ||
          new Date().toISOString(),
      })) as AppNotification[],
    };
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    return {
      success: false,
      notifications: [],
    };
  }
};

// ─── FCM Token Management ─────────────────────────────────────────────────────

/**
 * Saves (upserts) an FCM registration token for the **signed-in web user**.
 * Tokens are stored in the top-level `fcmTokens` collection using a deterministic hash key.
 *
 * Identity comes from the `session` cookie, so the `userId` argument is accepted
 * only for backward compatibility with existing call sites and is ignored — this
 * file is `"use server"`, so trusting a client-supplied uid here would let an
 * attacker register their own device under a victim's account.
 *
 * Mobile callers must NOT use this action (a Bearer client has no cookie);
 * `app/api/v1/notifications/register-device` calls `saveFCMTokenFor` directly
 * with the uid it verified from the Firebase ID token.
 */
export async function saveFCMToken(userId?: string, token?: string) {
  if (!token) return { success: false, error: "Missing token" };
  const authUserId = await getAuthenticatedUserId();
  if (!authUserId) return { success: false, error: "Unauthorized" };

  return saveFCMTokenFor(authUserId, token);
}

/**
 * Removes a stale or revoked FCM registration token for the signed-in web user.
 * Mobile callers use `app/api/v1/notifications/device` instead.
 */
export async function removeFCMToken(token: string) {
  const authUserId = await getAuthenticatedUserId();
  if (!authUserId) return { success: false, error: "Unauthorized" };

  return removeFCMTokenFor(authUserId, token);
}
