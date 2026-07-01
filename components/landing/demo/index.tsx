"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockBodyScroll } from "@uidotdev/usehooks";
import { usePopStore } from "@/store";

import { TOPICS } from "./topics";
import { useDemoSim } from "./useDemoSim";
import { DemoHeader } from "./DemoHeader";
import { DemoTopicTabs } from "./DemoTopicTabs";
import { DemoProgress } from "./DemoProgress";
import { DemoChat } from "./DemoChat";
import { DemoInputBar } from "./DemoInputBar";

/**
 * DemoModal — interactive AI chat simulation modal.
 *
 * Architecture:
 *   useDemoSim      — all timer / simulation state (custom hook)
 *   DemoHeader      — macOS dots + branding + action buttons
 *   DemoTopicTabs   — topic selector tabs
 *   DemoProgress    — step progress bar
 *   DemoChat        — scrollable conversation area
 *   DemoInputBar    — fake typed input bar
 */
const DemoModal = () => {
  useLockBodyScroll();
  const setShowDemo = usePopStore((state) => state.setShowDemo);

  const [activeTopic, setActiveTopic] = useState(0);
  const topic = TOPICS[activeTopic];

  const { messages, typedText, status, stepIndex, isComplete, scrollRef, restart } =
    useDemoSim(topic.script, activeTopic);

  return (
    <AnimatePresence>
      {/* ---- Overlay ---- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-100 flex items-end sm:items-center justify-center sm:p-4"
        style={{ background: "rgba(8,14,28,0.85)" }}
        aria-modal="true"
        role="dialog"
        aria-label="LegalAdviser AI demo"
      >
        {/* Click-away backdrop */}
        <div
          className="absolute inset-0 backdrop-blur-md"
          onClick={() => setShowDemo(false)}
          aria-hidden="true"
        />

        {/* ---- Modal card ---- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={[
            "relative w-full bg-white dark:bg-[#0C1221]",
            // Mobile: full-width bottom sheet with rounded top corners
            "rounded-t-2xl sm:rounded-2xl",
            // Tablet/desktop: constrained width, shadow
            "sm:max-w-2xl",
            "shadow-[0_40px_100px_rgba(0,0,0,0.5)]",
            "border border-slate-200/80 dark:border-white/8",
            "overflow-hidden flex flex-col",
            // Height — leave a bit of breathing room; bottom sheet fills more on mobile
            "max-h-[92vh] sm:max-h-[88vh]",
            "z-10",
          ].join(" ")}
        >
          <DemoHeader
            onRestart={restart}
            onClose={() => setShowDemo(false)}
          />

          <DemoTopicTabs
            topics={TOPICS}
            activeTopic={activeTopic}
            onSelect={setActiveTopic}
          />

          <DemoProgress
            script={topic.script}
            stepIndex={stepIndex}
            status={status}
          />

          <DemoChat
            ref={scrollRef}
            topic={topic}
            activeTopic={activeTopic}
            messages={messages}
            status={status}
            isComplete={isComplete}
            onRestart={restart}
          />

          <DemoInputBar status={status} typedText={typedText} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoModal;
