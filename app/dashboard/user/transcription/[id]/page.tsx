"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { 
  ArrowLeft, 
  Mic, 
  Clock, 
  Calendar, 
  FileText, 
  Play, 
  Download, 
  Share2, 
  MoreVertical,
  Layers,
  CircleDollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { motion } from "framer-motion";

const SessionDetailPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const voiceSessions = useAppStore((state) => state.voiceSessions);
  const session = voiceSessions.find((s) => s.id === id);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full">
          <Mic size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Session Not Found</h2>
        <p className="text-slate-500">The session you are looking for does not exist or has been removed.</p>
        <Button onClick={() => router.back()} variant="outline">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="group flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-4 py-2"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold">Back to Archive</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-xl border-slate-200 dark:border-slate-700">
            <Share2 size={18} />
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl border-slate-200 dark:border-slate-700 text-red-500 hover:text-red-600">
            <MoreVertical size={18} />
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Mic size={240} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider w-fit">
              <Mic size={12} />
              Confirmed Session
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
              {session.title}
            </h1>
            <div className="flex flex-wrap items-center gap-6">
               <div className="flex items-center gap-2 text-slate-500">
                 <Calendar size={16} />
                 <span className="text-sm font-medium">{new Date(session.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
               </div>
               <div className="flex items-center gap-2 text-slate-500">
                 <Clock size={16} />
                 <span className="text-sm font-medium">{formatTime(session.duration)}</span>
               </div>
               <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg text-xs font-bold ring-1 ring-green-600/10">
                 Saved to Cloud
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
             <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between gap-8 mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Session ID</span>
                  <span className="text-xs font-mono text-slate-500">{session.id}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CircleDollarSign size={14} />
                      <span>Estimated Cost</span>
                    </div>
                    <span className="text-sm font-bold">${(session.cost || 0).toFixed(2)}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Summary & Recording */}
        <div className="md:col-span-1 space-y-8">
           <section className="bg-slate-900 dark:bg-slate-950 p-6 rounded-3xl text-white shadow-xl shadow-slate-900/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-500/20 border border-orange-500/30 rounded-xl">
                  <FileText size={18} className="text-orange-500" />
                </div>
                <h3 className="text-lg font-bold">Executive Summary</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 italic">
                &quot;{session.summary}&quot;
              </p>
              <div className="pt-6 border-t border-slate-800">
                <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold flex items-center gap-2">
                  <Download size={18} />
                  Export Summary
                </Button>
              </div>
           </section>

           <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl">
              <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Play size={18} className="text-orange-500" />
                Call Recording
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700">
                <audio 
                  controls 
                  src={session.audioUrl} 
                  className="w-full grayscale dark:invert opacity-80"
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
                High Fidelity AI Cleaned Audio
              </p>
           </section>
        </div>

        {/* Right Column: Transcripts */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <FileText className="text-orange-500" size={24} />
              Full Transcript
            </h3>
            <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-500">
              {(session.transcripts?.length || 0)} Turn Exchanges
            </div>
          </div>

          <div className="space-y-4">
            {session.transcripts && session.transcripts.length > 0 ? (
              session.transcripts.map((t, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: t.speaker === "user" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex flex-col ${t.speaker === "user" ? "items-end" : "items-start"}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    t.speaker === "user" 
                      ? "bg-orange-600 text-white rounded-tr-none shadow-lg shadow-orange-600/10" 
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm"
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                       <span className={`text-[10px] uppercase font-black tracking-widest ${
                         t.speaker === "user" ? "text-orange-200" : "text-orange-600"
                       }`}>
                         {t.speaker === "user" ? "You" : "Legal Assistant"}
                       </span>
                    </div>
                    <p className="text-[15px] leading-relaxed">
                      {t.text}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                No transcript segments available for this session.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
