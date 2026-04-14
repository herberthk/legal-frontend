"use client";
import { useAppStore } from "@/store";
import {
  Mic,
  Clock,
  ChevronLeft,
  ChevronRight,
  Activity,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCost, formatUniversalDate } from "@/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import MarkdownFormatter from "@/components/global/chat/MakdownFormater";
import { CustomButton } from "../ui/custom-button";

interface VoiceConsultationsProps {
  isDashboard?: boolean;
  sessions?: VoiceSession[];
  totalSessionsCount?: number;
}

const VoiceConsultations = ({
  isDashboard = false,
  sessions,
  totalSessionsCount = 0,
}: VoiceConsultationsProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storeSessions = useAppStore((state) => state.voiceSessions);
  const voiceSessions = sessions || storeSessions;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currentPage = parseInt(searchParams.get("page") || "1");
  const itemsPerPage = isDashboard ? 6 : 8;
  const totalCount = sessions ? totalSessionsCount : voiceSessions.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // When sessions are passed (from server), we use them directly.
  // When not (dashboard), we take first 6 from store.
  const currentSessions =
    sessions ||
    (isDashboard
      ? voiceSessions.slice(0, 6)
      : voiceSessions.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage,
        ));

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700/50 transition-all duration-300 ${isDashboard ? "mt-8" : ""}`}
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-linear-to-br from-orange-500 to-orange-600 text-white rounded-2xl shadow-lg shadow-orange-500/20">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {isDashboard
                ? "Recent Consultations"
                : "Voice Consultation History"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isDashboard
                ? "Your latest recorded voice sessions."
                : "Manage and playback your recorded voice sessions."}
            </p>
          </div>
        </div>
        {!isDashboard && (
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-full">
              {totalCount} Total Sessions
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {currentSessions.length === 0 ? (
          <div className="text-center py-16 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-700/50 rounded-3xl bg-slate-50/50 dark:bg-slate-900/20">
            <Mic size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No recorded sessions yet</p>
            <p className="text-sm">
              Start a voice chat to see your records here.
            </p>
          </div>
        ) : (
          <>
            {currentSessions.map((session) => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative overflow-hidden bg-white dark:bg-slate-900/40 rounded-2xl border transition-all duration-300 ${
                  expandedId === session.id
                    ? "border-orange-500 ring-4 ring-orange-500/5"
                    : "border-slate-100 dark:border-slate-700/50 hover:border-orange-200 dark:hover:border-orange-900/30 shadow-sm"
                }`}
              >
                <div
                  className="p-5 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(session.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl transition-colors duration-300 ${
                        expandedId === session.id
                          ? "bg-orange-500 text-white"
                          : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      <Mic size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {session.title || "Untitled Session"}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                          <Clock size={12} className="text-slate-400" />
                          {formatUniversalDate(session.createdAt)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="text-xs text-slate-500 font-medium">
                          {formatTime(session.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {expandedId === session.id ? (
                      <ChevronUp size={20} className="text-orange-500" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === session.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-5 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl mb-5">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-orange-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Summary
                            </span>
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {session.summary ? (
                              <MarkdownFormatter
                                content={session.summary}
                                role="assistant"
                              />
                            ) : (
                              "No summary available for this session."
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <CustomButton
                            component={Link}
                            href={`/dashboard/user/transcriptions/${session.id}`}
                            variant="transparent"
                            shape="rounded"
                            borderLeftWidth="4px"
                            borderLeftColor="#4f46e5"
                            borderRightWidth="4px"
                            borderRightColor="#ea580c"
                            className="bg-slate-100/50 dark:bg-slate-800/50"
                            leftIcon={<ExternalLink size={16} />}
                            hoverEffect="glow"
                            size="sm"
                          >
                            View Detail
                          </CustomButton>

                          <div className="flex-1" />

                          <div className="flex items-center gap-6 px-2">
                            <div className="text-center">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
                                Cost
                              </p>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {formatCost(session.cost || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {isDashboard ? (
              currentSessions.length > 5 && (
                <div className="mt-6 flex justify-center">
                  <CustomButton
                    component={Link}
                    href="/dashboard/user/transcriptions"
                    variant="transparent"
                    shape="rounded"
                    size="sm"
                    borderLeftWidth="4px"
                    borderLeftColor="#4f46e5"
                    borderRightWidth="4px"
                    borderRightColor="#ea580c"
                    className="bg-slate-100/50 dark:bg-slate-800/50"
                    rightIcon={<ChevronRight size={18} />}
                    hoverEffect="glow"
                  >
                    View All Sessions
                  </CustomButton>
                </div>
              )
            ) : (
              <div className="mt-8 flex items-center justify-between bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <p className="text-sm font-medium text-slate-500">
                  Showing{" "}
                  <span className="text-slate-900 dark:text-white">
                    {currentSessions.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-slate-900 dark:text-white">
                    {totalCount}
                  </span>{" "}
                  sessions
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-xl h-10 w-10 border border-slate-200 dark:border-slate-700 disabled:opacity-30 bg-white dark:bg-slate-800"
                  >
                    <ChevronLeft size={20} />
                  </Button>

                  <div className="flex items-center gap-1 mx-2">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handlePageChange(i + 1)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          currentPage === i + 1
                            ? "bg-orange-500 w-8"
                            : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                        }`}
                      />
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-xl h-10 w-10 border border-slate-200 dark:border-slate-700 disabled:opacity-30 bg-white dark:bg-slate-800"
                  >
                    <ChevronRight size={20} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceConsultations;
