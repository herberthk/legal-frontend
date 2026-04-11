"use client";

import { Skeleton } from "@/components/ui/skeleton";

const TranscriptionDetailSkeleton = () => {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header Navigation Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* Hero Section Skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 flex-1">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-10 w-3/4 rounded-lg" />
            <div className="flex flex-wrap items-center gap-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-32 rounded-lg" />
            </div>
          </div>

          <div className="w-full md:w-64">
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column Skeleton */}
        <div className="md:col-span-1 space-y-8">
          <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-3xl space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="md:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>

          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex flex-col ${i % 2 === 0 ? "items-end" : "items-start"}`}
              >
                <div className="w-full max-w-[85%] space-y-2">
                  <div className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton
                    className={`h-24 w-full rounded-2xl ${
                      i % 2 === 0 ? "rounded-tr-none" : "rounded-tl-none"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionDetailSkeleton;
