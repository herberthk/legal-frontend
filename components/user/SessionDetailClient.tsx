"use client";

import { FileText, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

import MarkdownFormatter from "@/components/global/chat/MakdownFormater";
import { CustomButton } from "../ui/custom-button";

interface SessionDetailClientProps {
  session: VoiceSession;
}

const SessionDetailClient = ({ session }: SessionDetailClientProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left Column: Summary & Recording */}
      <div className="md:col-span-1 space-y-8">
        <section className="bg-slate-100 dark:bg-slate-950 p-6 rounded-3xl text-white shadow-xl shadow-slate-900/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/20 border border-orange-500/30 rounded-xl">
              <FileText size={18} className="text-orange-500" />
            </div>
            <h3 className="text-lg text-slate-900 dark:text-white font-bold">
              Executive Summary
            </h3>
          </div>
          <div className="text-slate-900 dark:text-white text-sm leading-relaxed mb-6 italic">
            {session.summary ? (
              <MarkdownFormatter content={session.summary} role="assistant" />
            ) : (
              "No summary available."
            )}
          </div>
          <div className="pt-6 border-t border-slate-800">
            <CustomButton
              variant="transparent"
              shape="rounded"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className="bg-slate-100/50 dark:bg-slate-800/50"
              leftIcon={<Download size={16} />}
              hoverEffect="glow"
            >
              Export conversation
            </CustomButton>
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
              src={session.audioUrl || undefined}
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
            {session.transcripts?.length || 0} Turn Exchanges
          </div>
        </div>

        <div className="space-y-4">
          {session.transcripts && session.transcripts.length > 0 ? (
            session.transcripts.map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: t.role === "user" ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (idx % 10) * 0.05 }}
                className={`flex flex-col ${t.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-2xl ${
                    t.role === "user"
                      ? "bg-orange-600 text-white rounded-tr-none shadow-lg shadow-orange-600/10"
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[10px] uppercase font-black tracking-widest ${
                        t.role === "user"
                          ? "text-orange-200"
                          : "text-orange-600"
                      }`}
                    >
                      {t.role === "user" ? "You" : "Legal Assistant"}
                    </span>
                  </div>
                  <div className="text-[15px] leading-relaxed">
                    <MarkdownFormatter
                      content={t.content}
                      role={t.role === "user" ? "user" : "assistant"}
                    />
                  </div>
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
  );
};

export default SessionDetailClient;
