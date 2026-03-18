"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const BillingSkeleton = () => {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-12 w-40 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* balance card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-12 w-48" />
            </div>
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          </div>

          {/* chart */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex justify-between mb-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>

          {/* transactions */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
             </div>
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center gap-4">
                <Skeleton className="h-8 w-64 rounded-full" />
                <div className="flex gap-4">
                   <Skeleton className="h-8 w-48 rounded-full" />
                   <Skeleton className="h-8 w-32 rounded-lg" />
                </div>
             </div>
             <div className="space-y-0">
               {[1, 2, 3, 4, 5, 6].map((i) => (
                 <div key={i} className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <Skeleton className="h-10 w-10 rounded-full" />
                       <div className="space-y-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32" />
                       </div>
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-6 w-8 rounded" />
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
             <div className="flex justify-between items-center mb-6">
               <Skeleton className="h-6 w-32" />
               <Skeleton className="h-10 w-10 rounded-full" />
             </div>
             <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingSkeleton;
