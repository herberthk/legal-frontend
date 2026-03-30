"use client";

import React from "react";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { getRelativeTime } from "@/utils";
import Link from "next/link";
import { motion } from "framer-motion";

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
  isAdmin,
}) => {
  const Icon = {
    INFO: Info,
    SUCCESS: CheckCircle,
    WARNING: AlertTriangle,
    ERROR: XCircle,
  }[notification.type];

  const colors = {
    INFO: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
    SUCCESS: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
    WARNING: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    ERROR: "text-rose-500 bg-rose-50 dark:bg-rose-900/20",
  }[notification.type];

  const hoverColors = isAdmin
    ? "hover:bg-indigo-50 dark:hover:bg-indigo-900/10"
    : "hover:bg-orange-50 dark:hover:bg-orange-900/10";

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  const Content = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer transition-all duration-200 flex gap-3 relative ${hoverColors} ${
        !notification.isRead
          ? isAdmin
            ? "bg-indigo-50/30 dark:bg-indigo-900/5"
            : "bg-orange-50/30 dark:bg-orange-900/5"
          : ""
      }`}
    >
      <div className={`p-2 rounded-lg h-fit ${colors}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0 pr-10">
        <div className="flex justify-between items-start mb-1">
          <h4
            className={`text-sm font-semibold truncate ${
              !notification.isRead
                ? "text-slate-900 dark:text-white"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {notification.title}
          </h4>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
          {notification.message}
        </p>
        <div className="flex items-center text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">
          <Clock size={10} className="mr-1" />
          {getRelativeTime(notification.createdAt)}
        </div>
      </div>

      {/* Action Buttons - Visible on hover */}
      <div className="absolute top-4 right-4 flex items-center gap-1 opacity-10 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 rounded-full p-1 sm:p-0">
        {notification.isRead ? (
          <button
            onClick={(e) =>
              handleAction(e, () => onMarkUnread?.(notification.id))
            }
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Mark as unread"
          >
            <Circle size={14} />
          </button>
        ) : (
          <button
            onClick={(e) =>
              handleAction(e, () => onMarkRead?.(notification.id))
            }
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-500 transition-colors"
            title="Mark as read"
          >
            <CheckCircle2 size={14} />
          </button>
        )}
        <button
          onClick={(e) => handleAction(e, () => onDelete?.(notification.id))}
          className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Unread Indicator */}
      {!notification.isRead && (
        <span
          className={`absolute top-4 right-2 w-2 h-2 rounded-full group-hover:hidden transition-all ${
            isAdmin ? "bg-indigo-500" : "bg-orange-500"
          }`}
        />
      )}
    </motion.div>
  );

  if (notification.url) {
    return (
      <Link
        href={notification.url}
        onClick={() => onMarkRead?.(notification.id)}
        className="block"
      >
        {Content}
      </Link>
    );
  }

  return Content;
};

export default NotificationItem;
