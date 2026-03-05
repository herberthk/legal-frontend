---
name: gsap
description: GSAP animations for JARVIS HUD transitions and effects (React Optimized)
risk_level: LOW
---

# GSAP Animation Skill (React)

> **React Optimization**: This skill is optimized for React using the `@gsap/react` hook for safe, automatic cleanup and scoping.

## 1. Overview

This skill provides GSAP (GreenSock Animation Platform) expertise for creating smooth, professional animations in the JARVIS AI Assistant HUD using React.

**Risk Level**: LOW - Animation library with minimal security surface

**Primary Use Cases**:

- HUD panel entrance/exit animations
- Status indicator transitions
- Data visualization animations
- Scroll-triggered effects
- Complex timeline sequences

## 2. Core Responsibilities

### 2.1 Fundamental Principles

1. **TDD First**: Write animation tests before implementation
2. **React Correctness**: Use the `@gsap/react` hook for all animations to ensure proper cleanup and avoiding React strict mode double-invocations
3. **Performance Aware**: Use transforms/opacity for GPU acceleration, avoid layout thrashing
4. **Scoping**: Always use the `scope` property in `useGSAP` to avoid global selector conflicts
5. **Memory Management**: Cleanup is handled automatically by `useGSAP`, but manual timelines must be killed if created outside the hook
6. **Accessibility**: Respect reduced motion preferences

## 2.5 Implementation Workflow (TDD)

### Step 1: Write Failing Test First

```typescript
// tests/animations/HUDPanel.test.tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gsap } from "gsap";
import HUDPanel from "@/components/HUDPanel";

describe("HUDPanel Animation", () => {
  beforeEach(() => {
    // Mock reduced motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // Verify cleanup
    gsap.globalTimeline.clear();
  });

  it("animates panel entrance with correct properties", async () => {
    render(<HUDPanel>Content</HUDPanel>);

    // Wait for animation to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const panel = screen.getByRole("complementary");
    expect(panel).toBeInTheDocument();
  });
});
```

### Step 2: Implement Minimum to Pass

```tsx
// components/HUDPanel.tsx
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export default function HUDPanel({ children }: { children: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(".hud-panel", { opacity: 1 });
        return;
      }

      gsap.from(".hud-panel", {
        opacity: 0,
        y: 20,
        duration: 0.5,
      });
    },
    { scope: container },
  );

  return (
    <div ref={container} role="complementary">
      <div className="hud-panel">{children}</div>
    </div>
  );
}
```

### Step 3: Refactor Following Patterns

```tsx
// Use custom hook for complex animations
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

export function usePanelAnimation(
  containerRef: React.RefObject<HTMLDivElement>,
) {
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(".animate-target", { opacity: 1 });
        return;
      }

      gsap.from(".animate-target", {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power2.out",
      });
    },
    { scope: containerRef },
  );
}
```

### Step 4: Run Full Verification

```bash
# Run animation tests
npm test -- --grep "Animation"

# Check for memory leaks
npm run test:memory

# Verify 60fps performance
npm run test:performance
```

## 3. Technology Stack & Versions

### 3.1 Recommended Versions

| Package       | Version  | Notes                        |
| ------------- | -------- | ---------------------------- |
| gsap          | ^3.12.0  | Core library                 |
| @gsap/react   | ^2.1.0   | React hook integration (New) |
| ScrollTrigger | included | Scroll effects               |

### 3.2 React Setup

```typescript
// lib/gsap.ts
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
```

## 4. Implementation Patterns

### 4.1 Panel Entrance Animation

```tsx
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export const HUDPanel = ({ children }) => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // ✅ Check reduced motion preference
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(".hud-panel", { opacity: 1 });
        return;
      }

      gsap.from(".hud-panel", {
        opacity: 0,
        y: 20,
        scale: 0.95,
        duration: 0.5,
        ease: "power2.out",
      });
    },
    { scope: container },
  ); // ✅ Scoping prevents global selector issues

  return (
    <div ref={container}>
      <div className="hud-panel">{children}</div>
    </div>
  );
};
```

### 4.2 Status Indicator Animation (Imperative)

```tsx
import { useRef, useCallback } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export const StatusIndicator = ({ status }: { status: string }) => {
  const container = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: container });

  // Use contextSafe for events/imperative triggers
  const triggerAnimation = contextSafe(() => {
    const tl = gsap.timeline();

    switch (status) {
      case "active":
        tl.to(".dot", { scale: 1.2, duration: 0.2 }).to(".dot", {
          scale: 1,
          duration: 0.3,
          ease: "elastic.out",
        });
        break;
      case "warning":
        tl.to(".dot", {
          backgroundColor: "#f59e0b",
          duration: 0.3,
          repeat: 2,
          yoyo: true,
        });
        break;
    }
  });

  return (
    <div ref={container} onClick={triggerAnimation}>
      <div className="dot" />
    </div>
  );
};
```

### 4.3 Data Visualization Animation (Reactive)

```tsx
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export const DataBar = ({ data }: { data: number[] }) => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.to(".bar", {
        height: (i) => `${data[i]}%`,
        duration: 0.5,
        stagger: 0.05,
        ease: "power2.out",
        overwrite: "auto", // Prevent conflicts on rapid updates
      });
    },
    { dependencies: [data], scope: container },
  ); // ✅ Re-run when data changes

  return (
    <div ref={container} className="flex items-end h-40 gap-1">
      {data.map((_, i) => (
        <div key={i} className="bar w-4 bg-blue-500" />
      ))}
    </div>
  );
};
```

## 5. Quality Standards

### 5.1 Performance

```typescript
// ✅ GOOD - Use transforms for GPU acceleration
gsap.to(element, {
  x: 100,
  y: 50,
  rotation: 45,
  scale: 1.2,
});

// ❌ BAD - Triggers layout recalculation
gsap.to(element, {
  left: 100,
  top: 50,
  width: "120%",
});
```

### 5.2 Accessibility

```tsx
// ✅ Respect reduced motion in React
useGSAP(
  () => {
    const isReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (isReduced) {
      gsap.set(".target", { opacity: 1 });
    } else {
      gsap.from(".target", { opacity: 0, duration: 0.5 });
    }
  },
  { scope: container },
);
```

## 6. Performance Patterns

### 6.1 will-change Property Usage

```typescript
// Good: Apply will-change before animation
const onEnter = (element: HTMLElement) => {
  element.style.willChange = "transform, opacity";
  gsap.to(element, {
    x: 0,
    opacity: 1,
    onComplete: () => {
      element.style.willChange = "auto";
    },
  });
};
```

### 6.2 Context Management with useGSAP

The `@gsap/react` hook automatically creates a `gsap.context()` which handles memory cleanup. Always use `contextSafe` for functions that run outside of the initial hook execution (like event handlers).

```tsx
const { contextSafe } = useGSAP({ scope: container });

const onClick = contextSafe(() => {
  gsap.to(".box", { rotation: "+=360" });
});
```

## 8. Common Mistakes & Anti-Patterns

### 8.1 Critical Anti-Patterns

#### Never: Use useEffect for GSAP in React

Using `useEffect` for GSAP often leads to memory leaks and double-firing in Strict Mode. Use `useGSAP`.

```tsx
// ❌ BAD
useEffect(() => {
  gsap.to(".box", { x: 100 });
}, []);

// ✅ GOOD
useGSAP(
  () => {
    gsap.to(".box", { x: 100 });
  },
  { scope: container },
);
```

#### Never: Animate Layout Properties

```typescript
// ❌ BAD - Causes layout thrashing
gsap.to(element, { width: 200, height: 100 });

// ✅ GOOD - Use transforms
gsap.to(element, { scaleX: 2, scaleY: 1 });
```

## 13. Pre-Implementation Checklist

### Phase 1: Planning

- [ ] Write failing tests using React Testing Library
- [ ] identify scope containers (Refs)
- [ ] Check for data dependencies that should trigger re-animation

### Phase 2: Implementation

- [ ] Use `useGSAP` for all animation logic
- [ ] Apply `scope` to all hooks
- [ ] Use `contextSafe` for event-driven animations
- [ ] Implement `overwrite: "auto"` for reactive data animations

### Phase 3: Verification

- [ ] Components unmount cleanly (no GSAP warnings)
- [ ] Animations work in Strict Mode (no double-jumps)
- [ ] Performance maintained (60fps)

## 14. Summary

GSAP React best practices:

1. **useGSAP**: Use it for all hooks to ensure cleanup.
2. **Scoping**: Use `scope` to target elements locally.
3. **contextSafe**: Use it for event handlers.
4. **GPU First**: Animate transforms and opacity only.

---

**References**:

- [advanced-patterns.md](references/advanced-patterns.md) - Complex animation patterns
- `@gsap/react` official documentation
- GreenSock React patterns guide
