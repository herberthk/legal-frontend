"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const DashboardSkeleton = () => {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48 md:w-64" />
          <Skeleton className="h-5 w-64 md:w-80" />
        </div>
        <Skeleton className="h-10 w-full md:w-32 rounded-lg" />
      </div>

      {/* Usage Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Voice Selection Skeleton */}
      <Skeleton className="h-32 w-full rounded-2xl" />

      {/* Main Grid Skeleton */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
        <div>
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>

      {/* Usage History Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 border-b border-slate-50 dark:border-slate-700 last:border-0 flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16 invisible md:visible" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Voice Consultations Skeleton */}
      <Skeleton className="h-48 w-full rounded-2xl" />

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
