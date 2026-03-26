"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { revalidatePath } from "next/cache";

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
  }
) {
  try {
    const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc();
    const notification: AppNotification = {
      id: notificationRef.id,
      userId,
      ...data,
      isRead: false,
      createdAt: new Date().toISOString(),
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
  } = {}
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

    const notifications = snapshot.docs.map((doc) => doc.data() as AppNotification);

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
    await db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .doc(notificationId)
      .delete();

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}
