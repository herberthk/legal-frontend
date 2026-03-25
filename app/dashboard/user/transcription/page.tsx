"use client";

import React, { useState, useMemo } from "react";
import { Mic, Search, Calendar } from "lucide-react";
import { useAppStore } from "@/store";
import VoiceConsultations from "@/components/user/VoiceConsultations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TranscriptionPage = () => {
  const voiceSessions = useAppStore((state) => state.voiceSessions);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<UsageFilter>("last_week");

  const filteredSessions = useMemo(() => {
    return voiceSessions.filter((session) => {
      const sessionDate = new Date(session.date);
      const now = new Date();
      
      // Search filter
      const matchesSearch = 
        (session.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (session.summary || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Time filter
      switch (filter) {
        case "today":
          return sessionDate.toDateString() === now.toDateString();
        case "yesterday":
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          return sessionDate.toDateString() === yesterday.toDateString();
        case "last_week":
          const lastWeek = new Date(now);
          lastWeek.setDate(now.getDate() - 7);
          return sessionDate >= lastWeek;
        case "month":
          const lastMonth = new Date(now);
          lastMonth.setMonth(now.getMonth() - 1);
          return sessionDate >= lastMonth;
        default:
          return true;
      }
    });
  }, [voiceSessions, searchQuery, filter]);

  const filterOptions: { label: string; value: UsageFilter }[] = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 Days", value: "last_week" },
    { label: "This Month", value: "month" },
    { label: "All Time", value: "custom" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
            <Mic size={12} />
            History & Transcripts
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Consultation <span className="text-orange-600">Archive</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Access and manage all your past legal consultations, view AI summaries, and read full session transcripts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
          <Button 
            variant="outline" 
            className="h-11 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center gap-2 px-4"
          >
            <Calendar size={18} className="text-slate-400" />
            <span className="hidden sm:inline">Advanced</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              filter === opt.value
                ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-6">
        <VoiceConsultations isDashboard={false} sessions={filteredSessions} />
      </div>

      {/* Help Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-linear-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-8 rounded-3xl text-white overflow-hidden relative group">
        <div className="relative z-10 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Mic className="w-6 h-6 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold">Need a specific session?</h2>
          <p className="text-slate-400 max-w-md">
            All your voice consultations are automatically recorded and summarized by our AI. 
            If you can&apos;t find a session, try searching by keywords or legal topics discussed.
          </p>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white border-none rounded-xl h-11 px-6">
            Contact Support
          </Button>
        </div>
        
        <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none translate-x-1/4 translate-y-1/4">
          <Mic size={300} />
        </div>
      </div>
    </div>
  );
};

export default TranscriptionPage;
