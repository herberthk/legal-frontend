import React, { forwardRef } from "react";
import { cva } from "class-variance-authority";
import {
  motion,
  AnimatePresence,
  TargetAndTransition,
  MotionStyle,
  VariantLabels,
  MotionProps,
} from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Motion Component Cache ---
const MotionButton = motion.create("button");
const motionCache = new Map<
  React.ElementType,
  React.ComponentType<Record<string, unknown>>
>();
function getMotionComponent(
  component: React.ElementType,
): React.ComponentType<Record<string, unknown>> {
  if (component === "button")
    return MotionButton as unknown as React.ComponentType<
      Record<string, unknown>
    >;
  let cached = motionCache.get(component);
  if (!cached) {
    cached = motion.create(
      component as React.ComponentType,
    ) as unknown as React.ComponentType<Record<string, unknown>>;
    motionCache.set(component, cached);
  }
  return cached;
}

// --- Enums ---

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "white"
  | "danger"
  | "outline"
  | "ghost"
  | "transparent"
  | "gradient-indigo"
  | "gradient-orange"
  | "gradient-mixed";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonShape = "square" | "rounded" | "pill";

export type ButtonShadow = "none" | "sm" | "md" | "lg" | "xl" | "2xl";

export type ButtonAnimation = "pulse" | "bounce" | "none";

export type ButtonTransition = "fade" | "slide" | "zoom" | "none";

export type ButtonHoverEffect = "scale" | "glow" | "shine" | "tilt" | "none";

export type ButtonBorderStyle = "solid" | "dashed" | "dotted" | "none";

// --- CVA Variants ---

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
        secondary: "bg-orange-600 text-white hover:bg-orange-700 shadow-sm",
        white:
          "bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-sm",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        transparent: "bg-transparent hover:bg-slate-100/10",
        "gradient-indigo":
          "bg-gradient-to-r from-indigo-600 to-indigo-400 text-white shadow-md hover:shadow-lg transition-shadow",
        "gradient-orange":
          "bg-gradient-to-r from-orange-600 to-orange-400 text-white shadow-md hover:shadow-lg transition-shadow",
        "gradient-mixed":
          "bg-gradient-to-r from-indigo-600 to-orange-600 text-white shadow-md hover:shadow-lg transition-shadow",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        md: "h-10 px-4 py-2 rounded-md",
        lg: "h-12 px-6 text-base rounded-lg",
      },
      shape: {
        square: "rounded-none",
        rounded: "rounded-md",
        pill: "rounded-full",
      },
      shadow: {
        none: "shadow-none",
        sm: "shadow-sm",
        md: "shadow-md",
        lg: "shadow-lg",
        xl: "shadow-xl",
        "2xl": "shadow-2xl",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      shape: "rounded",
      shadow: "sm",
      fullWidth: false,
    },
  },
);

// --- Animation Variants ---

const animationVariants: Record<string, TargetAndTransition> = {
  pulse: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  bounce: {
    y: [0, -6, 0],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  none: {},
};

type TransitionEffect = {
  initial: TargetAndTransition | VariantLabels | boolean;
  animate: TargetAndTransition | VariantLabels;
  exit: TargetAndTransition | VariantLabels;
};

const transitionVariants: Record<string, TransitionEffect> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { x: -10, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 10, opacity: 0 },
  },
  zoom: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.05, opacity: 0 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

// --- Props ---

export type CustomButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  shadow?: ButtonShadow;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  animation?: ButtonAnimation;
  transitionType?: ButtonTransition;
  hoverEffect?: ButtonHoverEffect;
  // Border Width overrides
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  // Border Color overrides
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderStyle?: ButtonBorderStyle;
  // Border Radius (Angles)
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomRightRadius?: string;
  borderBottomLeftRadius?: string;
  borderAnimation?: boolean;
};

export type CustomButtonProps<T extends React.ElementType> =
  CustomButtonBaseProps & {
    component?: T;
  } & Omit<
      React.ComponentPropsWithoutRef<T>,
      keyof CustomButtonBaseProps | "component"
    > &
    MotionProps;

// eslint-disable-next-line react/display-name
const CustomButtonInner = forwardRef(
  <T extends React.ElementType = "button">(
    {
      className,
      variant = "primary",
      size = "md",
      shape = "rounded",
      shadow = "sm",
      fullWidth = false,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      animation = "none",
      transitionType = "none",
      hoverEffect = "scale",
      component,
      borderTopWidth,
      borderRightWidth,
      borderBottomWidth,
      borderLeftWidth,
      borderColor,
      borderTopColor,
      borderRightColor,
      borderBottomColor,
      borderLeftColor,
      borderStyle = "solid",
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomRightRadius,
      borderBottomLeftRadius,
      borderAnimation,
      style,
      whileHover,
      whileTap,
      ...props
    }: CustomButtonProps<T>,
    ref: React.Ref<never>,
  ) => {
    const Component = component || "button";

    // Runtime enforcement for href if it's likely a Link
    const dynamicProps = props as Record<string, unknown>;
    if (
      component &&
      component !== "button" &&
      component !== "div" &&
      !dynamicProps.href
    ) {
      throw new Error(
        "CustomButton: The 'href' prop is required when using a custom component link.",
      );
    }
    // Generate border-related styles
    const borderStyles: MotionStyle = {
      // Widths
      borderTopWidth,
      borderRightWidth,
      borderBottomWidth,
      borderLeftWidth,
      // Colors
      borderColor: borderColor || "transparent",
      borderTopColor: borderTopColor || borderColor,
      borderRightColor: borderRightColor || borderColor,
      borderBottomColor: borderBottomColor || borderColor,
      borderLeftColor: borderLeftColor || borderColor,
      borderStyle,
      // Radii (Angles)
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomRightRadius,
      borderBottomLeftRadius,
      ...style,
    };

    const contentTransition = transitionVariants[transitionType];

    // Helper to determine what properties to animate on hover
    const getHoverStyles = () => {
      if (whileHover) return whileHover;
      switch (hoverEffect) {
        case "scale":
          return { scale: 1.02 };
        case "glow":
          return {
            scale: 1.01,
            boxShadow: "0 0 20px rgba(79, 70, 229, 0.4)",
            filter: "brightness(1.1)",
          };
        case "tilt":
          return { rotateX: 5, rotateY: 5, scale: 1.02 };
        case "shine":
          return { scale: 1.01 };
        default:
          return {};
      }
    };

    const componentContent = (
      <>
        <AnimatePresence mode="wait">
          <motion.div
            key={isLoading ? "loading" : "content"}
            className="flex items-center justify-center gap-2 dark:text-slate-100 text-slate-900"
            initial={contentTransition.initial}
            animate={contentTransition.animate}
            exit={contentTransition.exit}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                {leftIcon && (
                  <span className="flex items-center">{leftIcon}</span>
                )}
                <motion.span className="relative">{children}</motion.span>
                {rightIcon && (
                  <span className="flex items-center">{rightIcon}</span>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Animated Border Overlay */}
        {(borderAnimation || isLoading) && (
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              padding: "2px",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              borderRadius: "inherit",
              overflow: "hidden",
            }}
          >
            <motion.div
              className="absolute -inset-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 60%, #4f46e5 85%, #ea580c 100%)",
              }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            />
          </div>
        )}

        {/* Shine Effect Overlay */}
        {hoverEffect === "shine" && (
          <motion.div
            initial={{ left: "-100%" }}
            whileHover={{ left: "100%" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute top-0 w-1/2 h-full bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
          />
        )}

        {/* Glossy overlay effect for gradients */}
        {variant &&
          (variant === "primary" ||
            variant === "secondary" ||
            variant.toString().includes("gradient")) && (
            <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent pointer-events-none" />
          )}
      </>
    );

    const commonProps = {
      className: cn(
        buttonVariants({
          variant,
          size,
          shape,
          shadow,
          fullWidth,
        }),
        "perspective-500",
        isLoading && "disabled:cursor-not-allowed",
        className,
      ),
      style: borderStyles,
      animate: animation !== "none" ? animationVariants[animation] : undefined,
      whileHover: getHoverStyles(),
      whileTap: whileTap || { scale: 0.98 },
    };

    const mergedProps = {
      ...commonProps,
      ...props,
      disabled: isLoading || !!dynamicProps.disabled,
    } as Record<string, unknown>;
    mergedProps.ref = ref;

    return React.createElement(
      getMotionComponent(Component) as React.ElementType,
      mergedProps,
      componentContent,
    );
  },
) as unknown as {
  <T extends React.ElementType = "button">(
    props: CustomButtonProps<T> & { ref?: React.Ref<never> },
  ): React.ReactElement;
  displayName: string;
};
CustomButtonInner.displayName = "CustomButton";
const CustomButton = CustomButtonInner;

export { CustomButton, buttonVariants };
