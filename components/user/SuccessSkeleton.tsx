"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const SuccessSkeleton = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="rounded-2xl p-8 md:p-12 shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 relative overflow-hidden w-full max-w-lg text-center flex flex-col items-center">
        
        {/* Animated bounce check circle placeholder */}
        <div className="flex justify-center mb-6">
          <Skeleton className="h-28 w-28 rounded-full" />
        </div>

        {/* Title */}
        <Skeleton className="h-9 w-64 mb-4 rounded-lg" />
        {/* Description line */}
        <Skeleton className="h-4 w-80 mb-8 rounded" />

        {/* Receipt bullet details */}
        <div className="bg-slate-500/5 rounded-xl p-5 mb-8 text-left w-full space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-700/50" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="h-px bg-slate-200 dark:bg-slate-700/50" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>

        {/* Done Button */}
        <Skeleton className="h-12 w-full rounded-full" />

      </div>
    </div>
  );
};

export default SuccessSkeleton;
