import React, { memo } from "react";
import { Server, Mic } from "lucide-react";

interface ChatTokenUsageBadgeProps {
  textTokens: number;
  voiceSeconds: number;
}

export const ChatTokenUsageBadge = memo(
  ({ textTokens, voiceSeconds }: ChatTokenUsageBadgeProps) => {
  if (textTokens === 0 && voiceSeconds === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex justify-center mb-6 pointer-events-none">
      <div className="bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full text-[10px] font-medium text-slate-500 dark:text-slate-400 shadow-sm flex items-center gap-3">
        {textTokens > 0 && (
          <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
            <Server size={10} />
            {textTokens} Tokens
          </span>
        )}
        {textTokens > 0 && voiceSeconds > 0 && (
          <span className="w-px h-3 bg-slate-300 dark:bg-slate-600"></span>
        )}
        {voiceSeconds > 0 && (
          <span className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
            <Mic size={10} />
            {Math.floor(voiceSeconds / 60)}m {voiceSeconds % 60}s
          </span>
        )}
      </div>
    </div>
  );
});
ChatTokenUsageBadge.displayName = "ChatTokenUsageBadge";
