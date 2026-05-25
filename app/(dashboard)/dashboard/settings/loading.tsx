import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="container py-10 animate-pulse">
      <div className="max-w-4xl mx-auto flex flex-col gap-4 mb-10 text-left">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-96" />
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Skeleton */}
          <div className="w-full md:w-64 space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Main Content Skeleton */}
          <div className="flex-1">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 space-y-8">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>

              <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full" />
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-11 w-32 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
