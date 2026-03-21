"use client";

import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const ChatSessionSkeleton = () => {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-900 w-full">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-64 md:w-80 border-r border-slate-100 dark:border-slate-800 flex-col bg-white dark:bg-slate-950">
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
      <div className="flex-1 flex flex-col relative h-full min-w-0">
        <div className="flex-1 overflow-y-auto p-6 relative pt-8 md:pt-6">
          <div className="max-w-4xl flex-1 mx-auto flex flex-col justify-end min-h-full w-full space-y-6">
            
            {/* User Message Skeleton */}
            <div className="flex items-start max-w-3xl ml-auto flex-row-reverse w-full">
              <Skeleton className="shrink-0 w-10 h-10 rounded-full ml-3" />
              <div className="flex flex-col items-end w-full">
                <Skeleton className="h-16 w-3/4 md:w-[350px] rounded-2xl rounded-tr-none" />
              </div>
            </div>

            {/* AI Message Skeleton */}
            <div className="flex items-start max-w-3xl mr-auto w-full">
              <Skeleton className="shrink-0 w-10 h-10 rounded-full mr-3" />
              <div className="flex flex-col items-start w-full space-y-2">
                <Skeleton className="h-24 w-full md:w-[500px] rounded-2xl rounded-tl-none" />
              </div>
            </div>

            {/* User Message Skeleton */}
            <div className="flex items-start max-w-3xl ml-auto flex-row-reverse w-full">
              <Skeleton className="shrink-0 w-10 h-10 rounded-full ml-3" />
              <div className="flex flex-col items-end w-full">
                <Skeleton className="h-12 w-2/3 md:w-[250px] rounded-2xl rounded-tr-none" />
              </div>
            </div>

            {/* AI Message Skeleton */}
            <div className="flex items-start max-w-3xl mr-auto w-full">
              <Skeleton className="shrink-0 w-10 h-10 rounded-full mr-3 bg-orange-100 dark:bg-orange-900/30" />
              <div className="flex flex-col items-start w-full space-y-2">
                <Skeleton className="h-32 w-full md:w-[600px] rounded-2xl rounded-tl-none" />
              </div>
            </div>

          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto flex gap-4 items-end">
            <Skeleton className="h-14 flex-1 rounded-2xl" />
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSessionSkeleton;
