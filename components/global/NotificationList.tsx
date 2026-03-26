"use client";

import React, { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Bell, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  CheckCircle2, 
  BellOff,
  Search
} from "lucide-react";
import NotificationItem from "./NotificationItem";
import { markAllAsRead } from "@/lib/actions/notifications";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationListProps {
  initialNotifications: AppNotification[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  currentFilter: "ALL" | "UNREAD" | "READ";
  isAdmin: boolean;
  userId: string;
}

const NotificationList: React.FC<NotificationListProps> = ({
  initialNotifications,
  totalCount,
  totalPages,
  currentPage,
  currentFilter,
  isAdmin,
  userId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", filter);
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(userId);
    router.refresh();
  };

  const filters = [
    { label: "All", value: "ALL" },
    { label: "Unread", value: "UNREAD" },
    { label: "Read", value: "READ" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto mt-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                currentFilter === f.value
                  ? isAdmin
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    : "bg-orange-600 text-white shadow-md shadow-orange-200 dark:shadow-none"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleMarkAllRead}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition-colors"
          >
            <CheckCircle2 size={16} />
            <span className="hidden xs:inline">Mark all as read</span>
            <span className="xs:hidden">Mark all read</span>
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden transition-opacity duration-300 ${isPending ? "opacity-50" : "opacity-100"}`}>
        <AnimatePresence mode="wait">
          {initialNotifications.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-20 flex flex-col items-center justify-center text-center"
            >
              <div className={`p-6 rounded-full mb-6 ${isAdmin ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500" : "bg-orange-50 dark:bg-orange-900/20 text-orange-500"}`}>
                <BellOff size={48} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                No notifications found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {currentFilter === "ALL" 
                  ? "You don't have any notifications yet." 
                  : `You don't have any ${currentFilter.toLowerCase()} notifications.`}
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-slate-100 dark:divide-slate-700"
            >
              {initialNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  isAdmin={isAdmin}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing page <span className="font-semibold text-slate-700 dark:text-slate-200">{currentPage}</span> of <span className="font-semibold text-slate-700 dark:text-slate-200">{totalPages}</span>
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                   const pageNum = i + 1;
                   // Logic to show limited page numbers if totalPages is large
                   if (totalPages > 5) {
                     if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                       if (Math.abs(pageNum - currentPage) === 2) return <span key={pageNum} className="px-1 text-slate-400">...</span>;
                       return null;
                     }
                   }
                   return (
                     <button
                       key={pageNum}
                       onClick={() => handlePageChange(pageNum)}
                       className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                         currentPage === pageNum
                           ? isAdmin
                             ? "bg-indigo-600 text-white"
                             : "bg-orange-600 text-white"
                           : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                       }`}
                     >
                       {pageNum}
                     </button>
                   );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationList;
