import React from "react";

export default function AdminUsersLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="h-8 w-48 bg-slate-800 rounded-lg mb-2"></div>
            <div className="h-4 w-64 bg-slate-800/60 rounded-md"></div>
          </div>
          <div className="h-10 w-32 bg-slate-800 rounded-xl"></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="h-4 w-16 bg-slate-800 rounded mb-2"></div>
              <div className="h-8 w-24 bg-slate-800/80 rounded mb-1"></div>
              <div className="h-3 w-12 bg-slate-800/50 rounded"></div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 h-10 bg-slate-900 border border-slate-800 rounded-xl"></div>
          <div className="w-full md:w-32 h-10 bg-slate-900 border border-slate-800 rounded-xl"></div>
          <div className="w-full md:w-32 h-10 bg-slate-900 border border-slate-800 rounded-xl"></div>
          <div className="w-full md:w-32 h-10 bg-slate-900 border border-slate-800 rounded-xl"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-4 p-4 border-b border-slate-800 bg-slate-800/50">
            <div className="h-4 w-24 bg-slate-700/50 rounded"></div>
            <div className="h-4 w-24 bg-slate-700/50 rounded"></div>
            <div className="h-4 w-20 bg-slate-700/50 rounded"></div>
            <div className="h-4 w-20 bg-slate-700/50 rounded"></div>
            <div className="h-4 w-4 bg-slate-700/50 rounded"></div>
          </div>
          <div className="divide-y divide-slate-800/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_120px_120px_40px] gap-4 p-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-800 rounded"></div>
                    <div className="h-3 w-40 bg-slate-800/60 rounded"></div>
                  </div>
                </div>
                <div>
                  <div className="h-4 w-20 bg-slate-800 rounded mb-2"></div>
                  <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
                </div>
                <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
                <div className="h-4 w-24 bg-slate-800 rounded"></div>
                <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
