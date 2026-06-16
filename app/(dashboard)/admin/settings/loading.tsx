import React from "react";

export default function AdminSettingsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Skeleton */}
        <div>
          <div className="h-8 w-48 bg-slate-800 rounded-lg mb-3"></div>
          <div className="h-4 w-96 bg-slate-800/60 rounded-md"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
          {/* Left Column: Avatar Skeleton */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-slate-800 mb-4"></div>
              <div className="h-6 w-32 bg-slate-800 rounded-md mb-2"></div>
              <div className="h-4 w-40 bg-slate-800/60 rounded-md mb-4"></div>
              <div className="h-6 w-28 bg-indigo-500/10 rounded-full"></div>
            </div>
          </div>

          {/* Right Column: Forms Skeleton */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="h-6 w-48 bg-slate-800 rounded-md mb-6"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="h-10 w-32 bg-slate-800 rounded-xl"></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="h-6 w-32 bg-slate-800 rounded-md mb-6"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-slate-800 rounded"></div>
                  <div className="h-10 w-full bg-slate-800/50 rounded-xl"></div>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="h-10 w-40 bg-slate-800 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
