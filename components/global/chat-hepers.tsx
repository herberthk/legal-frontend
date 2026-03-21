import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MakdownFormater from "./MakdownFormater";
import type { UIMessage } from "ai";
// --- Helpers to extract content from UIMessage parts ---
export const getMessageText = (msg: UIMessage): string => {
  return (
    msg.parts
      ?.filter(
        (
          p,
        ): p is { type: "text"; text: string; state?: "streaming" | "done" } =>
          p.type === "text",
      )
      .map((p) => p.text)
      .join("") || ""
  );
};

export const getMessageReasoning = (msg: UIMessage): string => {
  return (
    msg.parts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?.filter((p): p is any => p.type === "reasoning")
      .map((p: { text: string }) => p.text)
      .join("") || ""
  );
};

export const isReasoningStreaming = (msg: UIMessage): boolean => {
  return (
    msg.parts?.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.type === "reasoning" && p.state === "streaming",
    ) ?? false
  );
};

export const getMessageFile = (
  msg: UIMessage,
): { name: string; type: string; url: string } | undefined => {
  const filePart = msg.parts?.find((p) => p.type === "file");
  if (!filePart || filePart.type !== "file") return undefined;
  return {
    name: filePart.filename || "Attached Document",
    type: filePart.mediaType,
    url: filePart.url,
  };
};

export const isMessageStreaming = (msg: UIMessage): boolean => {
  return (
    msg.parts?.some(
      (p) =>
        p.type === "text" && (p as { state?: string }).state === "streaming",
    ) ?? false
  );
};

// --- ThinkingBlock: Collapsible reasoning display with Framer Motion ---
interface ThinkingBlockProps {
  reasoning: string;
  isStreaming: boolean;
}

export const ThinkingBlock = ({
  reasoning,
  isStreaming,
}: ThinkingBlockProps) => {
  const startTimeRef = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Tracks whether the user manually collapsed the block after streaming ended
  const [userCollapsed, setUserCollapsed] = useState(false);

  // Side effect only: record elapsed time when streaming finishes
  useEffect(() => {
    if (isStreaming) {
      startTimeRef.current = Date.now();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserCollapsed(false);
    } else if (startTimeRef.current > 0) {
      setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      setUserCollapsed(true);
    }
  }, [isStreaming]);

  // While streaming → always open. After streaming → respect user toggle.
  const isOpen = isStreaming || !userCollapsed;

  if (!reasoning) return null;

  return (
    <div className="rounded-tl-xl rounded-tr-xl border border-orange-200/60 dark:border-orange-800/40 bg-orange-50/50 dark:bg-orange-950/20 overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => !isStreaming && setUserCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors"
      >
        <Sparkles
          size={13}
          className={`shrink-0 ${
            isStreaming
              ? "text-orange-500 animate-pulse"
              : "text-orange-400 dark:text-orange-500"
          }`}
        />
        <span className="flex-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 tracking-wide uppercase">
          {isStreaming ? "Thinking…" : `Thought for ${elapsedSeconds}s`}
        </span>
        {isStreaming ? (
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-orange-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : isOpen ? (
          <ChevronDown size={13} className="shrink-0 text-orange-400" />
        ) : (
          <ChevronRight size={13} className="shrink-0 text-orange-400" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="reasoning-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-orange-200/50 dark:border-orange-800/30">
              <div className="prose prose-sm prose-orange dark:prose-invert max-w-none text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-slate-500 [&_pre]:text-[10px] [&_code]:text-[10px]">
                <MakdownFormater content={reasoning} role="assistant" />
                {isStreaming && (
                  <span className="inline-block w-1 h-3 ml-0.5 mt-1 bg-orange-400 animate-pulse align-middle rounded-sm" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
