"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const NotificationsSkeleton = () => {
  return (
    <div className="p-2 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header section */}
      <div className="mb-8 flex items-center gap-4">
        {/* BackButton skeleton */}
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2 mt-0.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* Filters & Actions bar skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Filter pills */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>

        {/* Action Button */}
        <Skeleton className="h-9 w-full sm:w-36 rounded-lg" />
      </div>

      {/* Notifications list wrapper */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex gap-3 relative">
            {/* Left side circular icon placeholder */}
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            
            {/* Right side notification content */}
            <div className="flex-1 min-w-0 pr-10 space-y-2">
              <Skeleton className="h-4 w-1/4 rounded" />
              <Skeleton className="h-3.5 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/6 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default NotificationsSkeleton;
