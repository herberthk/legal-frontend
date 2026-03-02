# GSAP Cheat Sheet (Quick Reference)

Simplified reference for GSAP v3 based on the official [GSAP Cheat Sheet](https://gsap.com/cheatsheet/).

## Tweens (Basics)

```javascript
gsap.to(".selector", {
  x: 100,
  duration: 1,
  ease: "power2.inOut",
  stagger: 0.1,
  repeat: -1,
  yoyo: true,
});

gsap.from(".selector", { opacity: 0, y: 50 });

gsap.fromTo(".selector", { opacity: 0 }, { opacity: 1, duration: 1 });
```

## Timelines

```javascript
const tl = gsap.timeline({ defaults: { duration: 1, ease: "none" } });

tl.to(".box1", { x: 100 })
  .to(".box2", { y: 100 }, "-=0.5") // overlap by 0.5s
  .to(".box3", { rotate: 360 }, "<"); // start at same time as box2
```

## Control Methods

```javascript
const anim = gsap.to(...);

anim.play();
anim.pause();
anim.reverse();
anim.restart();
anim.timeScale(2); // double speed
anim.seek(1.5);    // jump to 1.5s
anim.progress(0.5); // jump to halfway
anim.kill();       // destroy
```

## ScrollTrigger

```javascript
gsap.to(".box", {
  scrollTrigger: {
    trigger: ".container",
    start: "top center", // trigger scroller
    end: "+=500",
    scrub: true,
    pin: true,
    markers: true, // development only
  },
  x: 500,
});
```

## Common Eases

- `none` (linear)
- `power1`, `power2`, `power3`, `power4` (.in, .out, .inOut)
- `back`
- `elastic`
- `bounce`
- `expo`
- `steps(n)`
