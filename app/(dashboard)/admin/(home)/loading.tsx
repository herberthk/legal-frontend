import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoadingSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto animate-pulse">
      {/* 1. Header skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* 2. Four Metric Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-36 space-y-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700/80" />
              <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700/80" />
            </div>
            <Skeleton className="h-8 w-32 rounded bg-slate-200 dark:bg-slate-700/80" />
            <Skeleton className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700/80" />
          </div>
        ))}
      </div>

      {/* 3. System Usage Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700/80" />
            <Skeleton className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700/80" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl bg-slate-200 dark:bg-slate-700/80" />
        </div>
        {/* Pie Chart */}
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6 flex flex-col">
          <Skeleton className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700/80" />
          <Skeleton className="h-72 w-full rounded-xl mt-4 bg-slate-200 dark:bg-slate-700/80" />
        </div>
      </div>

      {/* 4. Financial Header skeleton */}
      <div className="space-y-2 pt-4">
        <Skeleton className="h-7 w-64 rounded bg-slate-200 dark:bg-slate-700/80" />
        <Skeleton className="h-4 w-96 rounded bg-slate-200 dark:bg-slate-700/80" />
      </div>

      {/* 5. Four Financial Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col justify-between h-36 space-y-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700/80" />
              <Skeleton className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700/80" />
            </div>
            <Skeleton className="h-8 w-40 rounded bg-slate-200 dark:bg-slate-700/80" />
            <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700/80" />
          </div>
        ))}
      </div>

      {/* 6. Financial Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
          <Skeleton className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700/80" />
          <Skeleton className="h-[280px] w-full rounded-xl bg-slate-200 dark:bg-slate-700/80" />
        </div>
        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700/80" />
            <Skeleton className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700/80" />
          </div>
          <Skeleton className="h-[280px] w-full rounded-xl bg-slate-200 dark:bg-slate-700/80" />
        </div>
      </div>

      {/* 7. Demographics Title skeleton */}
      <div className="space-y-2 pt-4">
        <Skeleton className="h-7 w-48 rounded bg-slate-200 dark:bg-slate-700/80" />
        <Skeleton className="h-4 w-80 rounded bg-slate-200 dark:bg-slate-700/80" />
      </div>

      {/* 8. Demographics Charts skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-6 flex flex-col h-[320px]"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-700/80" />
              <Skeleton className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700/80" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-xl bg-slate-200 dark:bg-slate-700/80 mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
