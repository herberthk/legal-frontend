"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const ChatSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-slate-950">
      {/* Sidebar Skeleton */}
      <div className="w-64 md:w-80 border-r border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-3 rounded-lg flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3 w-16 ml-6" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area Skeleton */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-2xl mt-8">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSkeleton;
