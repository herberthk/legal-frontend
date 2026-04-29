"use client";

export const HistorySkeleton = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 animate-pulse">
        <div className="space-y-4">
          <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-6 w-96 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        </div>
        <div className="h-16 w-48 bg-slate-200 dark:bg-slate-800 rounded-pill" />
      </div>

      <div className="h-14 w-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl mb-8 animate-pulse" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-64 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 animate-pulse"
          >
            <div className="flex justify-between">
              <div className="h-12 w-12 bg-slate-100 dark:bg-slate-700 rounded-2xl" />
              <div className="h-8 w-8 bg-slate-50 dark:bg-slate-700/50 rounded-lg" />
            </div>
            <div className="h-6 w-3/4 bg-slate-100 dark:bg-slate-700 rounded-lg" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-50 dark:bg-slate-700/30 rounded-lg" />
              <div className="h-4 w-5/6 bg-slate-50 dark:bg-slate-700/30 rounded-lg" />
            </div>
            <div className="pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-between">
              <div className="h-4 w-24 bg-slate-50 dark:bg-slate-700/30 rounded-lg" />
              <div className="h-4 w-12 bg-slate-50 dark:bg-slate-700/30 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ViewRecordSkeleton = () => {
  return (
    <div className="min-h-screen bg-indigo-50/5 dark:bg-slate-900 transition-colors duration-500 p-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="h-10 w-40 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm" />

        <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">
          <div className="h-14 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-500/10 shadow-xl" />
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="h-12 w-32 bg-white dark:bg-slate-800 rounded-2xl" />
            <div className="h-12 w-32 bg-white dark:bg-slate-800 rounded-2xl" />
            <div className="h-12 w-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>

        <div className="h-[700px] w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border border-indigo-500/10 shadow-2xl" />
      </div>
    </div>
  );
};
