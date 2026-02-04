// --- Animation Variants ---

import { Variants } from "framer-motion";

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 60, damping: 15, duration: 0.8 },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.25, // Increased delay between items
      delayChildren: 0.1,
      when: "beforeChildren",
    },
  },
};

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.9, rotateX: -15 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: { type: "spring", stiffness: 70, damping: 15, mass: 1.2 },
  },
};

export const mockChatVariants: Variants = {
  hidden: { opacity: 0, x: 50, rotateY: 10 },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    transition: { type: "spring", stiffness: 50, damping: 20, delay: 0.2 },
  },
  float: {
    y: [0, -10, 0],
    rotate: [0, 0.5, -0.5, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
};
