// --- Animation Variants ---

import { Variants } from "framer-motion";

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 80, damping: 18, duration: 0.6 },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.05,
      when: "beforeChildren",
    },
  },
};

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 80, damping: 18, mass: 1 },
  },
};

export const mockChatVariants: Variants = {
  hidden: { opacity: 0, x: 50, rotateY: 10 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { type: "spring", stiffness: 60, damping: 22, delay: 0.2 },
  },
  float: {
    y: [0, -10, 0],
    rotate: [0, 0.5, -0.5, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
};
