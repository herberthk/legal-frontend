"use client";

import { Skeleton } from "@/components/ui/skeleton";

const DashboardSkeleton = () => {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 md:h-10 w-48 md:w-64" />
          <Skeleton className="h-4 md:h-5 w-64 md:w-80" />
        </div>
        <Skeleton className="h-11 w-full md:w-36 rounded-full" />
      </div>

      {/* Usage Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Voice Selection Skeleton */}
      <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3.5 w-48" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3"
            >
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Chart Skeleton */}
      <div className="w-full">
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>

      {/* Voice Consultations Skeleton */}
      <Skeleton className="h-64 w-full rounded-2xl" />

      {/* System Events Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
