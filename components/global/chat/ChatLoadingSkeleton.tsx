import React from "react";
import { Scale, User as UserIcon } from "lucide-react";

export function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      <div className="flex-1 md:p-6 p-2 pt-8 md:pt-6">
        <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full w-full space-y-6 pb-4">
          {/* User Bubble Placeholder */}
          <div className="flex items-start max-w-3xl ml-auto flex-row-reverse animate-pulse">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-orange-200 dark:bg-orange-900/50 ml-3 shadow-sm">
              <UserIcon size={20} className="text-orange-400 dark:text-orange-700" />
            </div>
            <div className="flex flex-col items-end w-full">
              <div className="h-[60px] w-64 md:w-96 bg-orange-100 dark:bg-slate-800 rounded-b-lg rounded-tl-lg rounded-tr-none px-4 py-3 shadow-sm border border-transparent dark:border-slate-700">
                <div className="h-3 bg-orange-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-orange-200 dark:bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>

          {/* Assistant Bubble Placeholder */}
          <div className="flex items-start max-w-3xl mr-auto animate-pulse">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-800 mr-3 shadow-sm">
              <Scale size={20} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div className="flex flex-col items-start w-full">
              <div className="h-[120px] w-72 md:w-[32rem] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-b-lg rounded-tr-lg rounded-tl-none px-4 py-4 shadow-sm">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full mb-3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6 mb-3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/6 mb-3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
              </div>
            </div>
          </div>
          
           {/* Assistant Small Bubble Placeholder */}
           <div className="flex items-start max-w-3xl mr-auto animate-pulse">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-800 mr-3 shadow-sm">
              <Scale size={20} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div className="flex flex-col items-start w-full">
              <div className="h-[60px] w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-b-lg rounded-tr-lg rounded-tl-none px-4 py-4 shadow-sm">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Input Skeleton */}
      <div className="shrink-0 relative z-10 w-full p-4 md:px-6 md:pb-6 animate-pulse">
        <div className="max-w-4xl mx-auto h-[70px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"></div>
      </div>
    </div>
  );
}
