"use client";
import Link from "next/link";
import { X, BellOff, CheckCheck } from "lucide-react";
import { useAuthStore, usePopStore } from "@/store";
import { useNotifications } from "@/hooks";
import NotificationItem from "./NotificationItem";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  unreadCount: number;
};

const NotificationPopUp = ({ unreadCount }: Props) => {
  const toggleNotifications = usePopStore((state) => state.toggleNotifications);
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  const {
    notifications,
    markAllAsRead,
    markAsRead,
    markAsUnread,
    deleteNotification,
    isLoading,
  } = useNotifications();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-200"
        onClick={toggleNotifications}
      ></motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10, x: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute right-0 mt-2 w-full md:w-90 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-200 overflow-hidden origin-top-right"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {unreadCount} UNREAD
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-slate-400 hover:text-emerald-500 transition-colors title='Mark all as read'"
              >
                <CheckCheck size={18} />
              </button>
            )}
            <button
              onClick={toggleNotifications}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto overflow-x-hidden custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {isLoading && notifications.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mb-4" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 flex flex-col items-center justify-center text-center"
              >
                <div
                  className={`p-4 rounded-full mb-4 ${isAdmin ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500" : "bg-orange-50 dark:bg-orange-900/20 text-orange-500"}`}
                >
                  <BellOff size={32} />
                </div>
                <h4 className="text-slate-900 dark:text-white font-semibold mb-1">
                  All caught up!
                </h4>
                <p className="text-slate-500 text-xs px-6">
                  No new notifications at the moment.
                </p>
              </motion.div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  isAdmin={isAdmin}
                  onMarkRead={markAsRead}
                  onMarkUnread={markAsUnread}
                  onDelete={deleteNotification}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer Link */}
        {notifications.length > 4 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-center">
            <Link
              href="/dashboard/notifications"
              onClick={toggleNotifications}
              className={`text-xs font-bold uppercase tracking-widest hover:underline flex items-center justify-center gap-2 ${isAdmin ? "text-indigo-600 dark:text-indigo-400" : "text-orange-600 dark:text-orange-400"}`}
            >
              View all notifications
            </Link>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default NotificationPopUp;
