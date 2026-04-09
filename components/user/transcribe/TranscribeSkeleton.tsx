"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export function TranscribeSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-3xl mx-auto w-full"
    >
      {/* Header Skeleton */}
      <div className="text-center mb-12 space-y-6">
        <div className="space-y-3 flex flex-col items-center">
          <Skeleton className="h-10 md:h-12 w-[80%] md:w-[60%] rounded-xl" />
          <Skeleton className="h-10 md:h-12 w-[60%] md:w-[40%] rounded-xl" />
        </div>
        <div className="space-y-2 flex flex-col items-center">
          <Skeleton className="h-5 w-[90%] md:w-[70%] rounded-lg" />
          <Skeleton className="h-5 w-[70%] md:w-[50%] rounded-lg" />
        </div>
      </div>

      {/* Upload Box Skeleton */}
      <div className="relative border-2 border-dashed border-indigo-100 dark:border-indigo-900/30 rounded-[2.5rem] p-12 md:p-20 flex flex-col items-center bg-white dark:bg-slate-900/50 shadow-2xl shadow-indigo-500/5">
        <Skeleton className="w-24 h-24 rounded-3xl mb-8" />
        <Skeleton className="h-8 w-64 mb-3 rounded-lg" />
        <Skeleton className="h-5 w-48 mb-8 rounded-lg" />
        <Skeleton className="h-14 w-40 rounded-full" />
      </div>

      {/* Optional Error Area Skeleton */}
      <div className="mt-8">
        <Skeleton className="h-16 w-full rounded-2xl opacity-50" />
      </div>
    </motion.div>
  );
}
