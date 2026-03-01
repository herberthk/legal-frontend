---
title: GSAP in React & TypeScript
description: Master complex GSAP animations within a React and TypeScript environment using the `useGSAP` hook.
---

# GSAP with React and TypeScript

This skill provides a comprehensive guide to implementing professional animations using **GSAP** (GreenSock Animation Platform) in a **React** and **TypeScript** project.

## Setup and Installation

Install GSAP and the official React wrapper:

```bash
npm install gsap @gsap/react
```

## Core Concept: The `useGSAP` Hook

The `@gsap/react` package provides a `useGSAP` hook that handles animation cleanup automatically, which is critical in React (especially with `StrictMode`).

### Basic Usage with Scoping

Always use `scope` to target elements safely within a component.

```typescript
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const Box = () => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // GSAP code here...
    gsap.to(".box", { x: 360, duration: 2, repeat: -1, yoyo: true });
  }, { scope: container }); // scoping minimizes selector conflicts

  return (
    <div ref={container}>
      <div className="box">Animated Box</div>
    </div>
  );
};
```

## Complex Timelines

Timelines allow you to sequence multiple animations with precise control.

```typescript
useGSAP(
  () => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 });

    tl.to(".box", { x: 100, duration: 1 })
      .to(".circle", { y: -50, duration: 0.5 }, "-=0.2") // start 0.2s before end of prev
      .to(".text", { opacity: 1, stagger: 0.1 });
  },
  { scope: container },
);
```

## TypeScript Best Practices

1. **Ref Types**: Use specific types like `useRef<HTMLDivElement>(null)`.
2. **GSAP Context**: `useGSAP` automatically creates a context for cleanup.
3. **Plugins**: Register plugins (ScrollTrigger, Flip, etc.) outside the component.

```typescript
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
```

## Performance & Optimization

- **`force3D: true`**: Encourages GPU acceleration.
- **`will-change`**: Use sparingly in CSS for complex elements.
- **Cleanup**: `useGSAP` handles this, but manual instances outside it must be `.kill()`ed.
