import React from "react";

export default function AdminUserDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Link */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-800 rounded"></div>
          <div className="h-4 w-24 bg-slate-800 rounded"></div>
        </div>

        {/* Header Profile Card */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 flex flex-col sm:flex-row gap-5">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-slate-800 shrink-0"></div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-48 bg-slate-800 rounded-lg"></div>
              <div className="h-5 w-16 bg-slate-800 rounded-full"></div>
            </div>
            <div className="flex flex-wrap gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-800"></div>
                  <div className="h-4 w-24 bg-slate-800 rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-3 w-40 bg-slate-800/60 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 bg-slate-800 rounded-xl"></div>
            <div className="h-10 w-28 bg-slate-800 rounded-xl"></div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <div className="h-8 w-8 rounded-full bg-slate-800 mb-3"></div>
              <div className="h-6 w-20 bg-slate-800 rounded mb-1"></div>
              <div className="h-3 w-16 bg-slate-800/60 rounded"></div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="h-6 w-48 bg-slate-800 rounded mb-6"></div>
            <div className="h-64 w-full bg-slate-800/30 rounded-xl"></div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center">
            <div className="w-48 h-48 rounded-full border-[16px] border-slate-800/50"></div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex gap-2 border-b border-slate-800/50 pb-4 mb-6">
            <div className="h-10 w-32 bg-slate-800 rounded-xl"></div>
            <div className="h-10 w-32 bg-slate-800/50 rounded-xl"></div>
          </div>
          
          {/* Table content skeleton */}
          <div className="space-y-4">
            <div className="h-12 w-full bg-slate-800/30 rounded-xl"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full bg-slate-800/40 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
