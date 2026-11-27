"use server";

import { getCurrentUser } from "@/lib/actions/auth";
import {
  checkWebPushUserRateLimit,
  triggerMultiplePushNotifications,
  triggerSinglePushNotification,
  type MultiplePushPayload,
  type PushDispatchResponse,
  type SinglePushPayload,
} from "@/lib/push-notifications";

export type NotificationPayload = SinglePushPayload;
export type MultipleNotificationPayload = MultiplePushPayload;

function isAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Reusable Server Action for single-recipient push notifications.
 * Non-admin callers may only notify themselves (`to === user.id`).
 */
export const sendSingleNotification = async (
  payload: SinglePushPayload,
): Promise<PushDispatchResponse> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: "Unauthorized", sent: 0, failed: 0 };
    }

    if (user.id !== payload.to && !isAdminRole(user.role)) {
      return {
        success: false,
        message: "Forbidden: users may only notify themselves.",
        sent: 0,
        failed: 0,
      };
    }

    if (!isAdminRole(user.role) && !checkWebPushUserRateLimit(user.id)) {
      return {
        success: false,
        message: "Too many push requests. Please wait a moment.",
        sent: 0,
        failed: 0,
      };
    }

    return await triggerSinglePushNotification(payload);
  } catch (error) {
    console.error("[Push] Could not send single notification:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send notification.",
      sent: 0,
      failed: 0,
    };
  }
};

/**
 * Reusable Server Action for multi-recipient push notifications.
 * Restricted to ADMIN and SUPER_ADMIN callers.
 */
export const sendMultipleNotifications = async (
  payload: MultiplePushPayload,
): Promise<PushDispatchResponse> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: "Unauthorized", sent: 0, failed: 0 };
    }

    if (!isAdminRole(user.role)) {
      return {
        success: false,
        message: "Forbidden: admin privileges required.",
        sent: 0,
        failed: 0,
      };
    }

    return await triggerMultiplePushNotifications(payload);
  } catch (error) {
    console.error("[Push] Could not send multiple notifications:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send notifications.",
      sent: 0,
      failed: 0,
    };
  }
};
