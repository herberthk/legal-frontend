"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const CheckoutSkeleton = () => {
  return (
    <div className="md:p-8 px-2 space-y-6 max-w-6xl mx-auto">
      {/* Top back button section */}
      <div className="p-2 md:p-4 mt-3 flex items-center">
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>

      <div className="px-2 md:px-4">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Left Column: Interactive Flow Card */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 min-h-[500px] flex flex-col justify-between">
              
              {/* Header Step indicators */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
                {/* Step indicators dots */}
                <div className="flex gap-2">
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                  <Skeleton className="h-1.5 flex-1 rounded-full" />
                </div>
              </div>

              {/* Middle content: amount selector placeholder */}
              <div className="my-8 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>

                {/* Amount grid cards (typically $10, $25, $50, $100, etc.) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                  ))}
                </div>

                {/* Custom Amount input block */}
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-14 w-full rounded-2xl" />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>

            </div>
          </div>

          {/* Right Column: Order Summary & Trust info */}
          <div className="lg:col-span-4 space-y-6 lg:pt-0 pt-2">
            
            {/* OrderSummary Skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <Skeleton className="h-6 w-32" />
              <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>

            {/* TrustCenter Skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSkeleton;
