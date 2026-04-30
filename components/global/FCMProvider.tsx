"use client";

/**
 * FCMProvider
 *
 * A zero-UI client component that bootstraps Firebase Cloud Messaging
 * for the current authenticated user.
 *
 * Mount it once in the root layout so every page benefits from push
 * notifications without each page having to initialise FCM itself.
 *
 * - Calls `useFCMPushNotifications` which handles permission requests,
 *   token storage, and foreground message toasts automatically.
 * - Renders nothing to the DOM.
 */

import { useFCMPushNotifications } from "@/hooks/use-fcm-push-notifications";
import { NotificationSoftPrompt } from "./NotificationSoftPrompt";

export default function FCMProvider() {
  const { showSoftPrompt, requestPermission, dismissSoftPrompt } =
    useFCMPushNotifications();

  return (
    <>
      {showSoftPrompt && (
        <NotificationSoftPrompt
          onAccept={requestPermission}
          onDismiss={dismissSoftPrompt}
        />
      )}
    </>
  );
}
