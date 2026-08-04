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

  // Live timer effect during active streaming
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isStreaming) {
      if (startTimeRef.current === 0) {
        startTimeRef.current = Date.now();
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserCollapsed(false);

      interval = setInterval(() => {
        setElapsedSeconds(Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000)));
      }, 500);
    } else {
      if (startTimeRef.current > 0) {
        const finalElapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setElapsedSeconds(finalElapsed);
        startTimeRef.current = 0;
        setUserCollapsed(true);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  // While streaming → always open. After streaming → respect user toggle.
  const isOpen = isStreaming || !userCollapsed;

  if (!reasoning) return null;

  return (
    <div className="rounded-tl-2xl rounded-tr-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden mb-[-8px] pb-2 relative z-0">
      {/* Header / Toggle */}
      <button
        onClick={() => !isStreaming && setUserCollapsed((c) => !c)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
          !isStreaming
            ? "hover:bg-slate-100/50 dark:hover:bg-slate-800/50 cursor-pointer"
            : "cursor-default"
        }`}
      >
        <Sparkles
          size={14}
          className={`shrink-0 ${
            isStreaming
              ? "text-orange-500 dark:text-orange-400 animate-pulse"
              : "text-slate-400 dark:text-slate-500"
          }`}
        />
        <span className="flex-1 text-[12px] font-medium text-slate-600 dark:text-slate-300 tracking-wide">
          {isStreaming
            ? `Thinking (${elapsedSeconds}s)...`
            : `Thought for ${elapsedSeconds} second${elapsedSeconds === 1 ? "" : "s"}`}
        </span>
        {isStreaming ? (
          <span className="flex gap-1 items-center mr-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </span>
        ) : isOpen ? (
          <ChevronDown
            size={14}
            className="shrink-0 text-slate-400 transition-transform duration-200"
          />
        ) : (
          <ChevronRight
            size={14}
            className="shrink-0 text-slate-400 transition-transform duration-200"
          />
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
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-slate-200/50 dark:border-slate-800/50 relative">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400 [&_p]:text-[12.5px] [&_p]:leading-relaxed [&_p]:text-slate-500 dark:[&_p]:text-slate-400 [&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0">
                <MakdownFormater
                  content={reasoning}
                  role="assistant"
                  isReasoning={true}
                  isStreaming={isStreaming}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
