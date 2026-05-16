"use client";

export function ReviewSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Action bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-3 w-56 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-10 w-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Score + radar row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      </div>

      {/* Summary */}
      <div className="space-y-3 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800">
        <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-4/6 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>

      {/* Risks */}
      <div className="space-y-3 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>

      {/* Clauses */}
      <div className="space-y-3 p-5 rounded-2xl bg-slate-100 dark:bg-slate-800">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
