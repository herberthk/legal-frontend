import { formatDuration } from "@/lib";
import { useAppStore } from "@/store";
import {
  Mic,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import React, { useState } from "react";

const VoiceConsultations = () => {
  // --- Voice Sessions State ---
  const voiceSessions = useAppStore((state) => state.voiceSessions);

  // Voice Session Pagination
  const [voicePage, setVoicePage] = useState(1);
  const voiceItemsPerPage = 4;

  // Voice Pagination Logic
  const totalVoicePages = Math.ceil(voiceSessions.length / voiceItemsPerPage);
  const currentVoiceSessions = voiceSessions.slice(
    (voicePage - 1) * voiceItemsPerPage,
    voicePage * voiceItemsPerPage,
  );
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mt-8 overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg">
          <Activity size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Recorded Voice Consultations
          </h3>
          <p className="text-xs text-slate-500">
            Playback your recent session recordings.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {voiceSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm italic border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
            No recorded sessions available. Start a voice chat to see records
            here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentVoiceSessions.map((session) => (
                <div
                  key={session.id}
                  className="group relative bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all hover:border-orange-500/20 dark:hover:border-orange-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  {/* Header with Icon and Date */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 p-2.5 rounded-xl">
                        <Mic size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          Legal Consultation
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(session.date).toLocaleDateString()} •{" "}
                          {new Date(session.date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {}}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100"
                      title="Delete Recording"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Context Preview */}
                  <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2">
                      &quot;{session.previewText}&quot;
                    </p>
                  </div>

                  {/* Audio Player */}
                  <div className="mt-2">
                    <audio
                      controls
                      src={session.audioUrl}
                      className="w-full h-8 [&::-webkit-media-controls-panel]:bg-slate-100 dark:[&::-webkit-media-controls-panel]:bg-slate-700 rounded-lg"
                    />
                    <div className="flex justify-between mt-1 px-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Duration: {formatDuration(session.duration)}
                      </span>
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                        Voice & AI Audio
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Voice Pagination Controls */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 rounded-lg p-3">
              <span className="text-xs text-slate-500">
                Page {voicePage} of {Math.max(1, totalVoicePages)}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setVoicePage((p) => Math.max(1, p - 1))}
                  disabled={voicePage === 1}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <ChevronLeft
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
                <button
                  onClick={() =>
                    setVoicePage((p) => Math.min(totalVoicePages, p + 1))
                  }
                  disabled={
                    voicePage === totalVoicePages || totalVoicePages === 0
                  }
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                >
                  <ChevronRight
                    size={20}
                    className="text-slate-600 dark:text-slate-400"
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceConsultations;
