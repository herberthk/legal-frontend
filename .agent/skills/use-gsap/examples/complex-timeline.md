# Example: Complex GSAP Timeline in React

This example demonstrates a multi-step component animation using `useGSAP` and a Timeline.

```typescript
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { GSAP_CONSTANTS } from '../scripts/gsap-utils';

export const ComplexCard = () => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Create a timeline for choreographed animations
    const tl = gsap.timeline({
      defaults: { ease: GSAP_CONSTANTS.EASE.PRIMARY, duration: 0.8 },
      repeat: -1,
      repeatDelay: 2
    });

    tl.from(".bg-overlay", { opacity: 0, scale: 1.1 })
      .from(".content-title", { x: -30, opacity: 0 }, "-=0.4")
      .from(".content-desc", { y: 20, opacity: 0 }, "-=0.6")
      .from(".cta-button", { scale: 0.5, opacity: 0, ease: GSAP_CONSTANTS.EASE.BOUNCE }, "+=0.2");

  }, { scope: container });

  return (
    <div ref={container} className="relative overflow-hidden w-full max-w-md p-6 rounded-xl border border-white/20 bg-black text-white">
      <div className="bg-overlay absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />

      <div className="relative z-10">
        <h2 className="content-title text-3xl font-bold mb-2">Premium Experience</h2>
        <p className="content-desc text-white/60 mb-6">
          Experience smooth and fluid interactions with GSAP and React.
        </p>
        <button className="cta-button px-6 py-2 bg-white text-black rounded-full font-semibold">
          Get Started
        </button>
      </div>
    </div>
  );
};
```

## How to use

1.  Place the `gsap-utils.ts` in your `shared/utils` or equivalent folder.
2.  Import the constants and use them within `useGSAP`.
3.  Target elements by class name within the `scope` of the parent `ref`.
