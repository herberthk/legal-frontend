"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const TransactionDetailSkeleton = () => {
  return (
    <div className="md:p-8 p-3 max-w-4xl mx-auto space-y-8">
      
      {/* Top Header Navigation skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>

        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>

      {/* Main layout grid */}
      <div className="grid md:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Premium Receipt Card */}
        <div className="md:col-span-8 space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
            
            {/* Stamp indicator placeholder */}
            <div className="absolute top-6 right-6">
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>

            {/* Receipt Header details */}
            <div className="space-y-2 mb-8 pt-4">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-52" />
            </div>

            {/* Large centered value block */}
            <div className="py-6 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center mb-8 space-y-3">
              <Skeleton className="h-3 w-28 mx-auto" />
              <div className="flex items-center justify-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-12 w-44" />
              </div>
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>

            {/* Detailed metadata list skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-36 mb-2" />
              
              <div className="grid grid-cols-2 gap-y-6 py-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4.5 w-36 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Cryptographic stamp note skeleton */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>

          </div>
        </div>

        {/* Right Column: Dynamic Info Sidebar */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Quick Stats Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4.5 w-4.5 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-2xl">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </div>

          {/* Need Support Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4.5 w-4.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>

            <Skeleton className="h-10 w-full rounded-xl" />
          </div>

        </div>

      </div>

    </div>
  );
};

export default TransactionDetailSkeleton;
