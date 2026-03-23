"use client";

import { Skeleton } from "@/components/ui/skeleton";

export const VoiceLoadingSkeleton = () => (
  <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#0F172A] relative overflow-hidden">
    {/* Header Skeleton */}
    <div className="shrink-0 flex justify-between items-center p-4 sm:p-6 z-20">
      <Skeleton className="h-10 w-40 rounded-full" />
      <Skeleton className="h-10 w-24 rounded-full" />
    </div>

    {/* Orb Skeleton Area */}
    <div className="absolute inset-0 flex flex-col items-center justify-center pt-16 pb-64 lg:pb-72">
      <div className="relative w-48 h-48 sm:w-72 sm:h-72 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-slate-100 dark:border-slate-800 animate-pulse scale-110 opacity-20" />
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700 animate-pulse scale-125 opacity-10" />
        <Skeleton className="w-24 h-24 sm:w-36 sm:h-36 rounded-full shadow-2xl" />
      </div>
      <div className="h-10 mt-8">
        <Skeleton className="h-4 w-48 rounded" />
      </div>
    </div>
  </div>
);

export default VoiceLoadingSkeleton;
