"use client";

export const ReviewHistorySkeleton = () => (
  <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
    <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse mb-4" />
    <div className="h-6 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-12" />
    <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
      <div className="h-14 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-56 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      ))}
    </div>
  </div>
);
