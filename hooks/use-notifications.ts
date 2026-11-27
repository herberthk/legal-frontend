"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  markAsUnread,
  deleteNotification,
  getLatestUnreadNotifications,
} from "@/lib/actions/notifications";
import { useAuthStore } from "@/store";

export const useNotifications = () => {
  const user = useAuthStore((state) => state.user);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  // const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const result = await getLatestUnreadNotifications(user.id);
    if (result.success) {
      setNotifications(result.notifications);
      // setTotalCount(result.totalCount);
      // Also fetch unread count separately if needed, but for the pop-up,
      // we can just use the totalCount from an unread-only query or calculate from a subset.
      // For simplicity, let's just fetch all unread count.
      // const unreadResult = await getNotifications(user.id, {
      //   filter: "UNREAD",
      // });
      // if (unreadResult.success) {
      //   setUnreadCount(unreadResult.totalCount);
      // }
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    const initFetch = async () => {
      await fetchNotifications();
    };
    initFetch();

    const onPushReceived = () => {
      void fetchNotifications();
    };
    window.addEventListener("fcm:notification-received", onPushReceived);
    return () => {
      window.removeEventListener("fcm:notification-received", onPushReceived);
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    const result = await markAsRead(id);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      // setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    return result;
  };

  const handleMarkAsUnread = async (id: string) => {
    const result = await markAsUnread(id);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
      );
      // setUnreadCount((prev) => prev + 1);
    }
    return result;
  };

  const handleDeleteNotification = async (id: string) => {
    const result = await deleteNotification(id);
    if (result.success) {
      // const deletedItem = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // setTotalCount((prev) => Math.max(0, prev - 1));
      // if (deletedItem && !deletedItem.isRead) {
      //   setUnreadCount((prev) => Math.max(0, prev - 1));
      // }
    }
    return result;
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    const result = await markAllAsRead(user.id);
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      // setUnreadCount(0);
    }
    return result;
  };

  return {
    notifications,
    isLoading,
    markAsRead: handleMarkAsRead,
    markAsUnread: handleMarkAsUnread,
    deleteNotification: handleDeleteNotification,
    markAllAsRead: handleMarkAllAsRead,
    refresh: fetchNotifications,
  };
};
