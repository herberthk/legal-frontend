"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const FreeCreditsSkeleton = () => {
  return (
    <div className="p-2 md:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* BackButton skeleton */}
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Next reward badge skeleton */}
        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-4 w-full md:w-auto">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5 flex-1 md:flex-none">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </div>

      {/* Content Section List */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
            </div>

            <div className="text-right space-y-1">
              <Skeleton className="h-6 w-24 ml-auto" />
              <Skeleton className="h-3.5 w-20 ml-auto" />
            </div>
          </div>
        ))}

        {/* Pagination controls skeleton */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mt-4">
          <Skeleton className="h-4 w-44" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-xl" />
            <Skeleton className="h-9 w-20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800/50 space-y-4">
        <Skeleton className="h-5 w-44" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </div>
    </div>
  );
};

export default FreeCreditsSkeleton;
