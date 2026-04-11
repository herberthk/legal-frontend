"use client";

import { Skeleton } from "@/components/ui/skeleton";

const ChatSkeleton = () => {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-slate-950">
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
