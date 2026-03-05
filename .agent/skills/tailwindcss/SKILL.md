---
name: tailwind-css
description: Comprehensive Tailwind CSS v4 guide. Covers Core Concepts, Base styles, Layout, Flexbox/Grid, Spacing, Sizing, Typography, Backgrounds, Borders, Effects, Filters, Tables, Transitions/Animation, Transforms, Interactivity, SVG, and Accessibility.
---

# Tailwind CSS v4 — Complete Guide (2026)

Tailwind CSS v4 introduces the high-performance Oxide engine (built in Rust) and shifts to a **CSS-first configuration**. The `tailwind.config.js` file is gone; customization now happens directly in CSS using the `@theme` directive.

## 1. Installation & Configuration (v4)

```css
/* app/globals.css */
@import "tailwindcss";

/* Configuration is now CSS-first */
@theme {
  --color-brand-500: #4f46e5;
  --font-display: "Oswald", sans-serif;
  --breakpoint-3xl: 1920px;
}
```

No content paths are needed; Tailwind v4 automatically detects source files in your project.

---

## 2. Core Concepts

### Utility-First Fundamentals

Build designs by composing small, single-purpose classes directly in your HTML:

```html
<div
  class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center gap-x-4"
>
  <div class="shrink-0">
    <img class="size-12" src="/logo.svg" alt="ChitChat Logo" />
  </div>
  <div>
    <div class="text-xl font-medium text-black">ChitChat</div>
    <p class="text-slate-500">You have a new message!</p>
  </div>
</div>
```

### Hover, Focus, and Other States

Use modifiers to target pseudo-classes and pseudo-elements.

```html
<!-- Hover, focus, active -->
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2 active:bg-blue-700">
  Submit
</button>

<!-- First, last, odd, even (for lists) -->
<li class="first:pt-0 last:pb-0 odd:bg-gray-100 even:bg-white">...</li>

<!-- Form states -->
<input
  class="disabled:opacity-50 invalid:border-red-500 required:border-blue-500"
/>
```

### Responsive Design

Tailwind uses a mobile-first breakpoint system:

- `sm:` (min-width: 640px)
- `md:` (min-width: 768px)
- `lg:` (min-width: 1024px)
- `xl:` (min-width: 1280px)
- `2xl:` (min-width: 1536px)

```html
<div class="text-center sm:text-left md:flex lg:hidden">...</div>
```

### Dark Mode

Dark mode is built-in and adapts to the OS preference by default, or you can force it using a class.

```html
<div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  This adapts to dark mode.
</div>
```

### Arbitrary Values

Use square brackets to generate utilities on the fly without configuring them.

```html
<div class="top-[117px] bg-[#bada55] text-[14px]">...</div>
<div class="grid-cols-[1fr_500px_2fr]">...</div>
```

---

## 3. Base Styles

Tailwind includes a preflight reset that normalizes browser styles:

- All margins are removed
- Headings are unstyled (no bold, no size difference)
- Lists have no bullets or indentation
- Images are block-level

To add custom base styles, use `@theme` or standard CSS:

```css
@import "tailwindcss";

@layer base {
  h1 {
    @apply text-2xl font-bold;
  }
  h2 {
    @apply text-xl font-semibold;
  }
}
```

---

## 4. Layout

| Category                        | Classes                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| **Aspect Ratio**                | `aspect-auto`, `aspect-square`, `aspect-video` (16/9), `aspect-[4/3]`                        |
| **Container**                   | `container` (locks max-width to current breakpoint)                                          |
| **Columns**                     | `columns-1` through `columns-12`, `columns-3xs` to `columns-7xl`                             |
| **Display**                     | `block`, `inline-block`, `inline`, `flex`, `grid`, `hidden`, `contents`                      |
| **Floats**                      | `float-right`, `float-left`, `float-none`, `clear-both`                                      |
| **Object Fit**                  | `object-contain`, `object-cover`, `object-fill`, `object-none`, `object-scale-down`          |
| **Object Position**             | `object-bottom`, `object-center`, `object-left-top`, `object-right`                          |
| **Overflow**                    | `overflow-auto`, `overflow-hidden`, `overflow-visible`, `overflow-scroll`, `overflow-x-auto` |
| **Position**                    | `static`, `fixed`, `absolute`, `relative`, `sticky`                                          |
| **Top / Right / Bottom / Left** | `inset-0`, `top-4`, `-left-4`, `right-[10px]`                                                |
| **Visibility**                  | `visible`, `invisible`, `collapse`                                                           |
| **Z-Index**                     | `z-0`, `z-10`, `z-50`, `z-auto`, `z-[-1]`                                                    |

---

## 5. Flexbox & Grid

### Flexbox

```html
<div
  class="flex flex-row md:flex-col justify-between items-center flex-wrap gap-4"
>
  <div class="flex-1">Stretches</div>
  <div class="shrink-0 text-center">Won't shrink</div>
  <div class="flex-none self-end">Stays original size, aligns to bottom</div>
</div>
```

| Property    | Utilities                                                                         |
| ----------- | --------------------------------------------------------------------------------- |
| Basics      | `flex`, `inline-flex`                                                             |
| Direction   | `flex-row`, `flex-row-reverse`, `flex-col`, `flex-col-reverse`                    |
| Wrap        | `flex-wrap`, `flex-wrap-reverse`, `flex-nowrap`                                   |
| Flex        | `flex-1` (1 1 0%), `flex-auto` (1 1 auto), `flex-initial` (0 1 auto), `flex-none` |
| Grow/Shrink | `grow`, `grow-0`, `shrink`, `shrink-0`                                            |
| Order       | `order-1`, `order-12`, `order-last`, `order-first`, `order-none`                  |

### CSS Grid

```html
<div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-4">
  <div class="col-span-1 md:col-span-2 lg:col-span-8">Main Content</div>
  <div class="col-start-2 row-start-1">Sidebar</div>
</div>
```

| Property       | Utilities                                           |
| -------------- | --------------------------------------------------- |
| Columns        | `grid-cols-1` to `12`, `grid-cols-none`             |
| Col Span       | `col-span-1` to `12`, `col-span-full`               |
| Col Start/End  | `col-start-1` to `13`, `col-end-1` to `13`          |
| Rows           | `grid-rows-1` to `6`, `grid-rows-none`              |
| Row Span       | `row-span-1` to `6`, `row-span-full`                |
| Grid Auto Flow | `grid-flow-row`, `grid-flow-col`, `grid-flow-dense` |

### Alignment & Justification

- **Justify Content:** `justify-start`, `justify-end`, `justify-center`, `justify-between`, `justify-around`
- **Align Items:** `items-start`, `items-end`, `items-center`, `items-baseline`, `items-stretch`
- **Align Self:** `self-auto`, `self-start`, `self-end`, `self-center`, `self-stretch`
- **Place Content:** `place-content-center`, `place-content-start`, `place-content-between`
- **Place Items:** `place-items-center`, `place-items-stretch`

---

## 6. Spacing

Spacing uses a multiple-of-4 proportional scale (e.g., `4` = 1rem = 16px, `8` = 2rem = 32px). `px` = 1px, `0.5` = 2px.

| Property        | Utilities                                             | Example                     |
| --------------- | ----------------------------------------------------- | --------------------------- |
| Padding         | `p-*`, `px-*`, `py-*`, `pt-*`, `pr-*`, `pb-*`, `pl-*` | `p-4` (padding: 1rem)       |
| Margin          | `m-*`, `mx-*`, `my-*`, `mt-*`, `mr-*`, `mb-*`, `ml-*` | `mt-8` (margin-top: 2rem)   |
| Negative Margin | `-m-*`, `-mx-*`, `-my-*`, `-mt-*`                     | `-mt-4` (margin-top: -1rem) |
| Space Between   | `space-x-*`, `space-y-*` (applied to parent)          | `space-y-4`                 |

---

## 7. Sizing

| Category   | Utilities                                                                  | Notes                                     |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| Width      | `w-full`, `w-screen`, `w-2/3`, `w-auto`, `w-4` to `w-96`, `w-[32rem]`      | `w-1/2` = 50%                             |
| Min-Width  | `min-w-0`, `min-w-full`, `min-w-min`, `min-w-max`, `min-w-fit`             |                                           |
| Max-Width  | `max-w-xs` to `max-w-7xl`, `max-w-full`, `max-w-prose` (65ch)              |                                           |
| Height     | `h-full`, `h-screen`, `h-svh`, `h-lvh`, `h-dvh`, `h-auto`, `h-4` to `h-96` | `h-dvh` = dynamic viewport                |
| Min-Height | `min-h-0`, `min-h-full`, `min-h-screen`, `min-h-svh`                       |                                           |
| Max-Height | `max-h-full`, `max-h-screen`, `max-h-24`                                   |                                           |
| Size       | `size-4`, `size-full`, `size-12`                                           | Sets both width and height simultaneously |

---

## 8. Typography

```html
<h1
  class="font-sans text-3xl md:text-5xl font-extrabold tracking-tight leading-loose text-slate-900 text-center uppercase md:normal-case truncate"
>
  The quick brown fox
</h1>
```

| Category              | Utilities                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Font Family           | `font-sans`, `font-serif`, `font-mono`                                                                |
| Font Size             | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` up to `text-9xl`                              |
| Font Weight           | `font-thin` (100) to `font-black` (900), `font-normal` (400), `font-bold` (700)                       |
| Letter Spacing        | `tracking-tighter`, `tracking-tight`, `tracking-normal`, `tracking-wide`, `tracking-widest`           |
| Line Height           | `leading-none`, `leading-tight`, `leading-snug`, `leading-normal`, `leading-relaxed`, `leading-loose` |
| Text Color            | `text-slate-900`, `text-blue-500/50` (50% opacity), `text-transparent`                                |
| Text Align            | `text-left`, `text-center`, `text-right`, `text-justify`                                              |
| Text Decoration       | `underline`, `overline`, `line-through`, `no-underline`, `decoration-wavy`, `decoration-blue-500`     |
| Text Transform        | `uppercase`, `lowercase`, `capitalize`, `normal-case`                                                 |
| Text Overflow         | `truncate` (ellipsis), `text-ellipsis`, `text-clip`                                                   |
| Whitespace & Wrapping | `whitespace-nowrap`, `whitespace-pre`, `break-words`, `break-all`                                     |

---

## 9. Backgrounds

```html
<div
  class="bg-indigo-500/80 bg-[url('/img/hero.jpg')] bg-cover bg-center bg-no-repeat bg-fixed"
>
  <div
    class="bg-linear-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text"
  >
    Gradient Text
  </div>
</div>
```

| Category            | Utilities                                                                         |
| ------------------- | --------------------------------------------------------------------------------- |
| Setup & Image       | `bg-[color]`, `bg-[url('...')]/bg-none`                                           |
| Size & Position     | `bg-auto/cover/contain`, `bg-bottom/center/left-top/right-bottom`                 |
| Repeat & Attachment | `bg-repeat/no-repeat/repeat-x/repeat-y`, `bg-fixed/local/scroll`                  |
| Clip & Origin       | `bg-clip-border/padding/content/text`, `bg-origin-border/padding/content`         |
| Gradients           | `bg-gradient-to-t/tr/r/br/b/bl/l/tl`, `from-[color]`, `via-[color]`, `to-[color]` |

---

## 10. Borders

```html
<div
  class="border-2 border-indigo-500 border-dashed rounded-xl rounded-t-none divide-y divide-slate-200"
>
  <div class="p-4">Item 1</div>
  <div class="p-4">Item 2</div>
</div>
```

| Category                  | Utilities                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Border Width              | `border`, `border-0`, `border-2`, `border-4`, `border-8`. Directional: `border-t-2`, `border-x-4`                                                 |
| Border Color              | `border-gray-500`, `border-blue-200/50`                                                                                                           |
| Border Style              | `border-solid`, `border-dashed`, `border-dotted`, `border-double`, `border-none`                                                                  |
| Border Radius             | `rounded-none`, `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`. Directional: `rounded-t-lg`, `rounded-tl-full` |
| Ring (Outline)            | `ring`, `ring-2`, `ring-inset`, `ring-blue-500/50`, `ring-offset-2`, `ring-offset-white`                                                          |
| Divide (Between children) | `divide-x`, `divide-y-2`, `divide-gray-200`, `divide-dashed`                                                                                      |
| Outline                   | `outline`, `outline-2`, `outline-offset-2`, `outline-blue-500`                                                                                    |

---

## 11. Effects

| Category         | Utilities                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Box Shadow       | `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-inner`, `shadow-none` |
| Box Shadow Color | `shadow-cyan-500/50`                                                                                      |
| Opacity          | `opacity-0`, `opacity-50`, `opacity-100`                                                                  |
| Mix Blend Mode   | `mix-blend-normal`, `mix-blend-multiply`, `mix-blend-screen`, `mix-blend-overlay`                         |
| Background Blend | `bg-blend-multiply`, `bg-blend-screen`, `bg-blend-overlay`                                                |

---

## 12. Filters & Backdrop Filters

### Filters (applies to the element itself)

```html
<img class="blur-sm grayscale contrast-150 drop-shadow-xl" src="..." />
```

- `blur-sm`, `blur-md`, `blur-xl`, `blur-[2px]`
- `brightness-50`, `brightness-110`
- `contrast-75`, `contrast-125`
- `drop-shadow-md`, `drop-shadow-xl` (follows PNG transparency)
- `grayscale-0`, `grayscale`
- `hue-rotate-90`, `-hue-rotate-180`
- `invert-0`, `invert`
- `saturate-50`, `saturate-200`
- `sepia-0`, `sepia`

### Backdrop Filters (applies to the area _behind_ the element)

Requires a transparent background color or opacity.

```html
<div class="bg-white/30 backdrop-blur-md backdrop-saturate-150">
  Glassmorphism
</div>
```

- `backdrop-blur-sm`, `backdrop-blur-xl`
- `backdrop-brightness-50`
- `backdrop-contrast-125`
- `backdrop-grayscale`
- `backdrop-hue-rotate-90`
- `backdrop-invert`
- `backdrop-opacity-50`
- `backdrop-saturate-200`
- `backdrop-sepia`

---

## 13. Tables

```html
<table class="table-auto border-collapse border border-slate-400">
  <caption class="caption-bottom">
    Table 1: Fruits
  </caption>
  <thead>
    <tr>
      <th class="border border-slate-300">Apple</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="border border-slate-300">Fuji</td>
    </tr>
  </tbody>
</table>
```

| Category        | Utilities                                                                      |
| --------------- | ------------------------------------------------------------------------------ |
| Border Collapse | `border-collapse`, `border-separate`, `border-spacing-2`, `border-spacing-x-4` |
| Table Layout    | `table-auto`, `table-fixed`                                                    |
| Caption Side    | `caption-top`, `caption-bottom`                                                |

---

## 14. Transitions & Animation

### Transitions

```html
<button
  class="bg-blue-500 hover:bg-blue-600 transition-colors duration-300 ease-in-out delay-150"
>
  Hover me
</button>
```

| Property            | Utilities                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Transition Property | `transition-none`, `transition-all`, `transition`, `transition-colors`, `transition-opacity`, `transition-shadow`, `transition-transform` |
| Duration            | `duration-75`, `duration-150`, `duration-300`, `duration-500`, `duration-[2s]`                                                            |
| Timing Function     | `ease-linear`, `ease-in`, `ease-out`, `ease-in-out`                                                                                       |
| Delay               | `delay-75`, `delay-150`, `delay-300`, `delay-500`                                                                                         |

### Keyframe Animations

Tailwind includes basic animations out of the box.

```html
<svg class="animate-spin size-5 mr-3" viewBox="0 0 24 24">...</svg>
<div class="rotate-x-45"></div>
<div class="animate-pulse bg-slate-200"></div>
<div class="animate-bounce"></div>
```

**Adding Custom Animations in v4 CSS:**

```css
@theme {
  --animate-wiggle: wiggle 1s ease-in-out infinite;

  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(-3deg);
    }
    50% {
      transform: rotate(3deg);
    }
  }
}
```

---

## 15. Transforms (2D & 3D)

In Tailwind v4, explicit `transform` class is no longer needed (it's applied automatically via CSS variables).

```html
<div
  class="scale-110 rotate-45 translate-x-1/2 -translate-y-4 skew-x-12 origin-top-left"
></div>
```

| Category  | Utilities                                                        |
| --------- | ---------------------------------------------------------------- |
| Scale     | `scale-0` to `scale-150`, `scale-x-50`, `scale-y-110`            |
| Rotate    | `rotate-0` to `rotate-180`, `-rotate-45`                         |
| Translate | `translate-x-4`, `translate-x-1/2`, `-translate-y-full`          |
| Skew      | `skew-x-0` to `skew-x-12`, `-skew-y-6`                           |
| Origin    | `origin-center`, `origin-top`, `origin-top-right`, `origin-left` |

### 3D Transforms (New in v4)

```html
<!-- Requires tailwindcss-3d plugin or explicit arbitrary values -->
<!-- Tailwind v4 natively supports 3d transforms via arbitrary values -->
<div class="perspective-[1000px]">
  <div class="rotate-x-45 translate-z-[100px] transform-style-[preserve-3d]">
    3D Object
  </div>
</div>
```

---

## 16. Interactivity

```html
<!-- A disabled, unselectable button with a crosshair cursor -->
<button class="cursor-not-allowed pointer-events-none select-none">
  Disabled
</button>

<!-- Smooth scrolling container -->
<html class="scroll-smooth">
  <div class="snap-y snap-mandatory overflow-y-scroll">
    <div class="snap-start h-screen">Section 1</div>
  </div>
</html>
```

| Category        | Utilities                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Appearance      | `appearance-none` (removes native styling)                                                         |
| Cursor          | `cursor-auto`, `cursor-pointer`, `cursor-not-allowed`, `cursor-wait`, `cursor-text`, `cursor-move` |
| Pointer Events  | `pointer-events-none`, `pointer-events-auto`                                                       |
| Resize          | `resize-none`, `resize-y`, `resize-x`, `resize`                                                    |
| Scroll Behavior | `scroll-smooth`, `scroll-auto`                                                                     |
| Scroll Padding  | `scroll-p-4`, `scroll-pt-24`                                                                       |
| Scroll Snap     | `snap-none`, `snap-x`, `snap-y`, `snap-mandatory`, `snap-proximity`                                |
| Snap Align      | `snap-start`, `snap-end`, `snap-center`, `snap-align-none`                                         |
| Touch Action    | `touch-auto`, `touch-none`, `touch-pan-x`, `touch-pan-y`, `touch-pinch-zoom`                       |
| User Select     | `select-none`, `select-text`, `select-all`, `select-auto`                                          |
| Will Change     | `will-change-scroll`, `will-change-transform`, `will-change-opacity`                               |

---

## 17. SVG

Control SVG styling natively.

```html
<svg class="fill-blue-500 stroke-blue-700 stroke-2" ...></svg>
<svg class="fill-current text-red-500" ...></svg>
<!-- Inherits red-500 color -->
```

| Category     | Utilities                                                        |
| ------------ | ---------------------------------------------------------------- |
| Fill         | `fill-current`, `fill-blue-500`, `fill-transparent`, `fill-none` |
| Stroke       | `stroke-current`, `stroke-blue-500`, `stroke-none`               |
| Stroke Width | `stroke-0`, `stroke-1`, `stroke-2`                               |

---

## 18. Accessibility

```html
<!-- Screen reader only (visually hidden but readable by screen readers) -->
<span class="sr-only">Toggle navigation menu</span>

<!-- Undo screen reader only (useful on focus) -->
<a href="#content" class="sr-only focus:not-sr-only">Skip to content</a>

<!-- Reduced motion media query -->
<div class="motion-safe:animate-spin">Safe</div>
<div class="motion-reduce:hidden">Hidden if prefers-reduced-motion</div>
```
