// Custom hook that owns all simulation timer logic.
// Extracted so the modal component stays thin and the engine is independently testable.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, ScriptStep, SimStatus } from "./types";

interface UseDemoSimResult {
  messages: Message[];
  typedText: string;
  status: SimStatus;
  stepIndex: number;
  isComplete: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  restart: () => void;
}

export function useDemoSim(
  script: ScriptStep[],
  /** Dependency key — change this to reset the simulation (e.g. activeTopic) */
  resetKey: number
): UseDemoSimResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SimStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const charIndexRef = useRef(0);
  const stepRef = useRef(0);
  const isRunningRef = useRef(false);

  // --- helpers -----------------------------------------------------------

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearTimer();
    isRunningRef.current = false;
    setMessages([]);
    setTypedText("");
    setStatus("idle");
    setStepIndex(0);
    setIsComplete(false);
    stepRef.current = 0;
    charIndexRef.current = 0;
  }, [clearTimer]);

  // Core step runner — returns a cleanup so both useEffect and restart() can use it
  const startSimulation = useCallback(
    (delayMs = 900) => {
      const runStep = () => {
        const idx = stepRef.current;
        if (idx >= script.length) {
          setIsComplete(true);
          setStatus("done");
          isRunningRef.current = false;
          return;
        }

        const step = script[idx];
        charIndexRef.current = 0;
        setStatus("typing");

        const typeChar = () => {
          if (charIndexRef.current < step.question.length) {
            setTypedText(step.question.substring(0, charIndexRef.current + 1));
            charIndexRef.current++;
            timeoutRef.current = setTimeout(typeChar, 28 + Math.random() * 28);
          } else {
            timeoutRef.current = setTimeout(() => {
              setMessages((prev) => [
                ...prev,
                { role: "user", content: step.question },
              ]);
              setTypedText("");
              setStatus("processing");

              timeoutRef.current = setTimeout(() => {
                setMessages((prev) => [
                  ...prev,
                  { role: "ai", content: step },
                ]);
                setStatus("responding");
                setStepIndex(idx + 1);

                timeoutRef.current = setTimeout(() => {
                  setStatus("idle");
                  stepRef.current = idx + 1;
                  timeoutRef.current = setTimeout(runStep, 1200);
                }, step.voiceDuration);
              }, 1400);
            }, 380);
          }
        };

        typeChar();
      };

      isRunningRef.current = true;
      const initTimer = setTimeout(runStep, delayMs);
      return () => {
        clearTimeout(initTimer);
        clearTimer();
        isRunningRef.current = false;
      };
    },
    // script is stable per topic — resetKey causes the effect to re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetKey, clearTimer]
  );

  // --- reset on topic change --------------------------------------------
  useEffect(() => {
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // --- start simulation -------------------------------------------------
  useEffect(() => {
    if (isRunningRef.current) return;
    const cleanup = startSimulation(900);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // --- auto-scroll ------------------------------------------------------
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status, typedText]);

  // --- public restart ---------------------------------------------------
  const restart = useCallback(() => {
    resetState();
    setTimeout(() => {
      startSimulation(300);
    }, 50);
  }, [resetState, startSimulation]);

  return { messages, typedText, status, stepIndex, isComplete, scrollRef, restart };
}
