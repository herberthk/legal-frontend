"use client";
import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/app";

const Notifications = () => {
  const notifications = useAppStore((state) => state.notifications);
  const setNotifications = useAppStore((state) => state.setNotifications);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const currentNotifications = notifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleMarkAllRead = () => {
    notifications.forEach((n) => (n.unread = false));
    setNotifications(notifications);
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle size={20} className="text-red-500" />;
      case "success":
        return <CheckCircle2 size={20} className="text-green-500" />;
      default:
        return <Info size={20} className="text-blue-500" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            View all your system alerts and updates.
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <Check size={16} />
          <span>Mark all as read</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
              <Bell size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">
              No notifications
            </h3>
            <p className="text-slate-500 mt-1">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {currentNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 md:p-6 flex gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${n.unread ? "bg-indigo-50/40 dark:bg-indigo-900/10" : ""}`}
              >
                <div
                  className={`mt-1 p-2 rounded-full h-fit ${n.unread ? "bg-white dark:bg-slate-800 shadow-sm" : "bg-slate-100 dark:bg-slate-800/50"}`}
                >
                  {getIcon(n.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p
                      className={`text-sm md:text-base ${n.unread ? "font-semibold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"}`}
                    >
                      {n.text}
                    </p>
                    <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                      {n.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {n.type === "alert"
                      ? "High Priority System Alert"
                      : "General Update"}
                  </p>
                </div>
                {n.unread && (
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2"></div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <span className="text-xs text-slate-500">
              Showing{" "}
              {Math.min(
                (currentPage - 1) * itemsPerPage + 1,
                notifications.length,
              )}{" "}
              to {Math.min(currentPage * itemsPerPage, notifications.length)} of{" "}
              {notifications.length}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
              >
                <ChevronLeft
                  size={16}
                  className="text-slate-600 dark:text-slate-400"
                />
              </button>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
              >
                <ChevronRight
                  size={16}
                  className="text-slate-600 dark:text-slate-400"
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
