import { Ticket } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div>
              <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-2" />
              <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0" />
        </div>

        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 flex items-center gap-3 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-8 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div className="w-full">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Ticket size={17} className="text-slate-300" />
              <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
            </h2>

            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded shrink-0 mt-1" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                    <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
