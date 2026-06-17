import { MessageSquare, Search } from "lucide-react";

export default function Loading() {
  return (
    <div className="h-[calc(100vh-80px)] flex flex-col animate-pulse">
      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <MessageSquare size={15} className="text-slate-400" />
              </div>
              <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </h1>
            <div className="h-3 w-64 bg-slate-200 dark:bg-slate-800 rounded-md mt-2 ml-10" />
          </div>

          {/* Quick stats skeleton */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                {i > 1 && <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />}
                <div className="text-center space-y-1">
                  <div className="h-6 w-8 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                  <div className="h-2 w-12 bg-slate-200 dark:bg-slate-800 rounded mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body: Split Pane ── */}
      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Left Pane skeleton */}
        <div className="flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 w-full md:w-80 lg:w-96 shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <div className="w-full h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="flex gap-2 pb-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0" />
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="px-4 py-3.5 w-full text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded mb-1.5" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane skeleton (hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 mb-4" />
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
}
