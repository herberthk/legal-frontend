import gsap from "gsap";

/**
 * Common GSAP easing and animation constants for consistent UX.
 */
export const GSAP_CONSTANTS = {
  EASE: {
    PRIMARY: "power3.out",
    IN_OUT: "power3.inOut",
    BOUNCE: "expo.out",
  },
  DURATION: {
    QUICK: 0.3,
    NORMAL: 0.5,
    SLOW: 0.8,
  },
} as const;

/**
 * Utility to split text into characters or words for staggered animations.
 */
export const staggerText = (target: string | HTMLElement, stagger = 0.05) => {
  return gsap.from(target, {
    opacity: 0,
    y: 20,
    duration: 0.8,
    stagger,
    ease: GSAP_CONSTANTS.EASE.PRIMARY,
  });
};

/**
 * Creates a standard hover effect for buttons or cards.
 */
export const createHoverScale = (element: HTMLElement, scaleValue = 1.05) => {
  const enter = () =>
    gsap.to(element, { scale: scaleValue, duration: 0.3, ease: "power2.out" });
  const leave = () =>
    gsap.to(element, { scale: 1, duration: 0.3, ease: "power2.in" });

  element.addEventListener("mouseenter", enter);
  element.addEventListener("mouseleave", leave);

  return () => {
    element.removeEventListener("mouseenter", enter);
    element.removeEventListener("mouseleave", leave);
  };
};
