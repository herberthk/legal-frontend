"use client";

import { useScroll, useSpring, useTransform, motion } from "framer-motion";

/**
 * ScrollProgressBar
 *
 * Premium fixed scroll-progress indicator.
 * – 3 px bar with an orange → indigo linear gradient fill
 * – Spring-physics smoothing for a silky natural feel
 * – Subtle glowing "dot" that rides the leading edge of the bar
 */
const ScrollProgressBar = () => {
  const { scrollYProgress } = useScroll();

  // Spring-smooth the raw scroll value for the bar scale
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  // Spring-smooth the same value for the glow dot position
  const rawLeft = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  // Map [0, 1] → ["0%", "100%"] for the dot's left position
  const dotLeft = useTransform(rawLeft, [0, 1], ["0%", "100%"]);

  return (
    <>
      {/* Translucent track backdrop */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-9999 bg-black/6 dark:bg-white/6"
        aria-hidden="true"
      />

      {/* Gradient progress fill — scales from left via transform-origin */}
      <motion.div
        role="progressbar"
        aria-label="Page scroll progress"
        aria-valuemin={0}
        aria-valuemax={100}
        className="fixed top-0 left-0 right-0 h-[3px] z-9999 origin-left"
        style={{
          scaleX,
          background:
            "linear-gradient(90deg, #f97316 0%, #fb923c 30%, #818cf8 68%, #6366f1 100%)",
          willChange: "transform",
        }}
      />

      {/* Glowing dot at the leading edge */}
      <motion.div
        className="fixed top-0 z-9999 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full pointer-events-none"
        style={{
          left: dotLeft,
          top: "1.5px",
          background:
            "radial-gradient(circle, rgba(251,146,60,0.95) 0%, rgba(129,140,248,0.55) 45%, transparent 72%)",
          filter: "blur(5px)",
          willChange: "left",
          opacity: 0.9,
        }}
        aria-hidden="true"
      />
    </>
  );
};

export default ScrollProgressBar;
