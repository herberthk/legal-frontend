"use client";
import { notifications } from "@/constants";
import { useAuthStore, usePopStore } from "@/store";
import { X } from "lucide-react";
import Link from "next/link";
import React from "react";

const NotificationPopUp = () => {
  const toggleNotifications = usePopStore((state) => state.toggleNotifications);
  const displayedNotifications = notifications().slice(0, 4);
  const isAdmin = useAuthStore((state) => state.user?.role === "ADMIN");
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={toggleNotifications}></div>
      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-200 animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Notifications
          </h3>
          <button
            onClick={toggleNotifications}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {displayedNotifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No new notifications
            </div>
          ) : (
            displayedNotifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group ${n.unread ? (isAdmin ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "bg-orange-50/50 dark:bg-orange-900/10") : ""}`}
              >
                <p
                  className={`text-sm text-slate-800 dark:text-slate-200 transition-colors ${isAdmin ? "group-hover:text-indigo-700 dark:group-hover:text-indigo-400" : "group-hover:text-orange-700 dark:group-hover:text-orange-400"}`}
                >
                  {n.text}
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                  {n.time}
                </span>
              </div>
            ))
          )}
        </div>
        {/* Footer Link */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-center">
          <Link
            href="/dashboard/notification"
            className={`text-xs font-bold uppercase tracking-wider hover:underline ${isAdmin ? "text-indigo-600 dark:text-indigo-400" : "text-orange-600 dark:text-orange-400"}`}
          >
            View all notifications
          </Link>
        </div>
      </div>
    </>
  );
};

export default NotificationPopUp;
