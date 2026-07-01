import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, ScriptStep, SimStatus } from "./types";

interface UseDemoSimResult {
  messages: Message[];
  typedText: string;
  status: SimStatus;
  stepIndex: number;
  isComplete: boolean;
  isPaused: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  togglePause: () => void;
  restart: () => void;
}

export function useDemoSim(script: ScriptStep[]): UseDemoSimResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedText, setTypedText] = useState("");
  const [status, setStatus] = useState<SimStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for pausing/resuming
  const charIndexRef = useRef(0);
  const stepRef = useRef(0);
  const phaseStartTimeRef = useRef(0);
  const remainingDelayRef = useRef(0);
  
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    clearTimer();
    setMessages([]);
    setTypedText("");
    setStatus("idle");
    setStepIndex(0);
    setIsComplete(false);
    setIsPaused(false);
    stepRef.current = 0;
    charIndexRef.current = 0;
    remainingDelayRef.current = 0;
  }, [clearTimer]);

  // Main simulation engine
  useEffect(() => {
    if (isPaused || isComplete) return;

    const runPhase = () => {
      const idx = stepRef.current;
      if (idx >= script.length) {
        setIsComplete(true);
        setStatus("done");
        return;
      }
      const step = script[idx];

      if (status === "idle") {
        // Transition to typing
        const delay = remainingDelayRef.current > 0 ? remainingDelayRef.current : 1000;
        phaseStartTimeRef.current = Date.now();
        remainingDelayRef.current = delay;

        timeoutRef.current = setTimeout(() => {
          remainingDelayRef.current = 0;
          charIndexRef.current = 0;
          setStatus("typing");
        }, delay);
      } 
      else if (status === "typing") {
        phaseStartTimeRef.current = Date.now();
        const typeChar = () => {
          if (charIndexRef.current < step.question.length) {
            setTypedText(step.question.substring(0, charIndexRef.current + 1));
            charIndexRef.current++;
            // Calculate random delay for realism
            const delay = 28 + Math.random() * 28;
            remainingDelayRef.current = delay;
            timeoutRef.current = setTimeout(typeChar, delay);
          } else {
            // Finished typing
            timeoutRef.current = setTimeout(() => {
              setMessages((prev) => [...prev, { role: "user", content: step.question }]);
              setTypedText("");
              remainingDelayRef.current = 1400; // time to process
              setStatus("processing");
            }, 380);
          }
        };
        typeChar();
      } 
      else if (status === "processing") {
        const delay = remainingDelayRef.current > 0 ? remainingDelayRef.current : 1400;
        phaseStartTimeRef.current = Date.now();
        remainingDelayRef.current = delay;

        timeoutRef.current = setTimeout(() => {
          setMessages((prev) => [...prev, { role: "ai", content: step }]);
          setStepIndex(idx + 1);
          remainingDelayRef.current = step.voiceDuration;
          setStatus("responding");
        }, delay);
      } 
      else if (status === "responding") {
        const delay = remainingDelayRef.current > 0 ? remainingDelayRef.current : step.voiceDuration;
        phaseStartTimeRef.current = Date.now();
        remainingDelayRef.current = delay;

        timeoutRef.current = setTimeout(() => {
          stepRef.current = idx + 1;
          remainingDelayRef.current = 1200; // time before next question
          setStatus("idle");
        }, delay);
      }
    };

    runPhase();

    return () => {
      // Calculate how much time is left in the current phase if we are pausing
      if (timeoutRef.current) {
        const elapsed = Date.now() - phaseStartTimeRef.current;
        remainingDelayRef.current = Math.max(0, remainingDelayRef.current - elapsed);
        clearTimer();
      }
    };
  }, [status, isPaused, isComplete, script, clearTimer]); // Drives the state machine automatically on status changes or unpause

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const restart = useCallback(() => {
    resetState();
    // After reset, useEffect will pick up from idle because isPaused is false
  }, [resetState]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status, typedText]);

  return { messages, typedText, status, stepIndex, isComplete, isPaused, scrollRef, togglePause, restart };
}
