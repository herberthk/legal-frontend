"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { createNoise2D } from "simplex-noise";

// ─── Status → Color Palettes ─────────────────────────────────────────────────
interface ColorSet {
  barStart: [number, number, number]; // bottom of bar
  barEnd: [number, number, number]; // top of bar
  altStart: [number, number, number]; // bottom of alternating bar
  altEnd: [number, number, number]; // top of alternating bar
  glow: [number, number, number]; // glow/bloom color
}

const STATUS_COLORS_DARK: Record<string, ColorSet> = {
  idle: {
    barStart: [79, 70, 229], // Indigo 600
    barEnd: [139, 92, 246], // Violet 500
    altStart: [67, 56, 202], // Indigo 700
    altEnd: [167, 139, 250], // Violet 400
    glow: [99, 102, 241],
  },
  listening: {
    barStart: [20, 184, 166], // Teal 500
    barEnd: [45, 212, 191], // Teal 400
    altStart: [13, 148, 136], // Teal 600
    altEnd: [94, 234, 212], // Teal 300
    glow: [20, 184, 166],
  },
  speaking: {
    barStart: [6, 182, 212], // Cyan 500
    barEnd: [34, 211, 238], // Cyan 400
    altStart: [8, 145, 178], // Cyan 600
    altEnd: [103, 232, 249], // Cyan 300
    glow: [34, 211, 238],
  },
  processing: {
    barStart: [147, 51, 234], // Purple 600
    barEnd: [192, 132, 252], // Purple 400
    altStart: [126, 34, 206], // Purple 700
    altEnd: [216, 180, 254], // Purple 300
    glow: [168, 85, 247],
  },
  muted: {
    barStart: [71, 85, 105], // Slate 600
    barEnd: [100, 116, 139], // Slate 500
    altStart: [51, 65, 85], // Slate 700
    altEnd: [148, 163, 184], // Slate 400
    glow: [71, 85, 105],
  },
  closed: {
    barStart: [5, 150, 105], // Emerald 600
    barEnd: [16, 185, 129], // Emerald 500
    altStart: [4, 120, 87], // Emerald 700
    altEnd: [52, 211, 153], // Emerald 400
    glow: [16, 185, 129],
  },
  error: {
    barStart: [220, 38, 38], // Red 600
    barEnd: [248, 113, 113], // Red 400
    altStart: [185, 28, 28], // Red 700
    altEnd: [252, 165, 165], // Red 300
    glow: [239, 68, 68],
  },
};

const STATUS_COLORS_LIGHT: Record<string, ColorSet> = {
  idle: {
    barStart: [99, 102, 241],
    barEnd: [165, 180, 252],
    altStart: [79, 70, 229],
    altEnd: [139, 92, 246],
    glow: [79, 70, 229],
  },
  listening: {
    barStart: [13, 148, 136],
    barEnd: [94, 234, 212],
    altStart: [15, 118, 110],
    altEnd: [45, 212, 191],
    glow: [13, 148, 136],
  },
  speaking: {
    barStart: [8, 145, 178],
    barEnd: [103, 232, 249],
    altStart: [14, 116, 144],
    altEnd: [34, 211, 238],
    glow: [8, 145, 178],
  },
  processing: {
    barStart: [126, 34, 206],
    barEnd: [216, 180, 254],
    altStart: [107, 33, 168],
    altEnd: [192, 132, 252],
    glow: [126, 34, 206],
  },
  muted: {
    barStart: [100, 116, 139],
    barEnd: [148, 163, 184],
    altStart: [71, 85, 105],
    altEnd: [100, 116, 139],
    glow: [71, 85, 105],
  },
  closed: {
    barStart: [5, 150, 105],
    barEnd: [110, 231, 183],
    altStart: [4, 120, 87],
    altEnd: [16, 185, 129],
    glow: [5, 150, 105],
  },
  error: {
    barStart: [220, 38, 38],
    barEnd: [252, 165, 165],
    altStart: [185, 28, 28],
    altEnd: [248, 113, 113],
    glow: [220, 38, 38],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerpColors(a: ColorSet, b: ColorSet, t: number): ColorSet {
  return {
    barStart: lerpRGB(a.barStart, b.barStart, t),
    barEnd: lerpRGB(a.barEnd, b.barEnd, t),
    altStart: lerpRGB(a.altStart, b.altStart, t),
    altEnd: lerpRGB(a.altEnd, b.altEnd, t),
    glow: lerpRGB(a.glow, b.glow, t),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
interface AudioVisualizerCanvasProps {
  status: CallStatus | "error";
  isDark: boolean;
  micLevel: number;
  aiAudioLevel: number;
}

const BAR_COUNT = 64; // number of bars across the width
const BAR_GAP = 4; // px gap between bars
const BAR_RADIUS = 4; // rounded top radius
const MIN_BAR_HEIGHT = 4; // minimum height so bars are always visible
const MAX_BAR_FRACTION = 0.55; // max bar height as fraction of canvas height

const AudioVisualizerCanvas: React.FC<AudioVisualizerCanvasProps> = ({
  status,
  isDark,
  micLevel,
  aiAudioLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const noise2D = useMemo(() => createNoise2D(), []);

  // Live audio refs
  const micRef = useRef(0);
  const aiRef = useRef(0);
  useEffect(() => {
    micRef.current = micLevel;
  }, [micLevel]);
  useEffect(() => {
    aiRef.current = aiAudioLevel;
  }, [aiAudioLevel]);

  // Smoothed audio values (inside animation loop)
  const smoothMic = useRef(0);
  const smoothAi = useRef(0);

  // Per-bar smoothed heights for silky movement
  const barHeights = useRef(new Float32Array(BAR_COUNT));

  // Status color transition
  const transitionRef = useRef({
    toStatus: status as string,
    progress: 1,
    fromColors:
      (isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT)[status] ||
      (isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT).idle,
    toColors:
      (isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT)[status] ||
      (isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT).idle,
  });

  useEffect(() => {
    const tr = transitionRef.current;
    if (tr.toStatus !== status) {
      const colorMap = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
      tr.fromColors = lerpColors(tr.fromColors, tr.toColors, tr.progress);
      tr.toStatus = status;
      tr.progress = 0;
      tr.toColors = colorMap[status] || colorMap.idle;
    }
  }, [status, isDark]);

  useEffect(() => {
    const tr = transitionRef.current;
    const colorMap = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
    tr.toColors = colorMap[tr.toStatus] || colorMap.idle;
    if (tr.progress >= 1) tr.fromColors = tr.toColors;
  }, [isDark]);

  // ── Main animation loop ───────────────────────────────────────────────────
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let lastTime = performance.now();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Helper: draw a single bar with rounded top
    const drawBar = (
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number,
    ) => {
      if (h < 1) return;
      const r = Math.min(radius, w / 2, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const tr = transitionRef.current;
      if (tr.progress < 1) tr.progress = Math.min(1, tr.progress + dt * 2.5);

      // Ease
      const eased =
        tr.progress < 0.5
          ? 4 * tr.progress * tr.progress * tr.progress
          : 1 - Math.pow(-2 * tr.progress + 2, 3) / 2;
      const colors = lerpColors(tr.fromColors, tr.toColors, eased);

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const time = now * 0.001;

      // Smooth audio levels
      const sf = 1 - Math.exp(-dt * 10);
      smoothMic.current = lerp(smoothMic.current, micRef.current, sf);
      smoothAi.current = lerp(smoothAi.current, aiRef.current, sf);

      // Determine audio influence
      const currentStatus = tr.toStatus;
      let audioLevel = 0;
      if (currentStatus === "listening") {
        audioLevel = Math.min(1, smoothMic.current * 5);
      } else if (currentStatus === "speaking") {
        audioLevel = Math.min(1, smoothAi.current * 4);
      } else if (currentStatus === "processing") {
        audioLevel = 0.25;
      } else {
        audioLevel = 0.05;
      }

      // ── Clear ──────────────────────────────────────────────────────────
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Bar geometry
      const totalGap = BAR_GAP * (BAR_COUNT - 1);
      const barWidth = Math.max(2, (w - totalGap) / BAR_COUNT);
      const maxBarH = h * MAX_BAR_FRACTION;

      // ── Compute and smooth bar heights ─────────────────────────────────
      const heights = barHeights.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const normalizedI = i / (BAR_COUNT - 1); // 0 to 1
        const centerDist = Math.abs(normalizedI - 0.5) * 2; // 0 at center, 1 at edges

        // Envelope: bars are taller near center, shorter at edges
        const envelope = 1 - Math.pow(centerDist, 2.2);

        // Noise-driven height (organic motion)
        const n1 = noise2D(normalizedI * 4, time * 0.8) * 0.5 + 0.5; // 0-1
        const n2 = noise2D(normalizedI * 8 + 100, time * 1.2) * 0.5 + 0.5;
        const noiseBlend = n1 * 0.7 + n2 * 0.3;

        // Base height (gentle idle movement)
        const baseHeight =
          MIN_BAR_HEIGHT + envelope * maxBarH * 0.06 * noiseBlend;

        // Audio-reactive height
        const audioHeight = envelope * maxBarH * audioLevel * noiseBlend;

        // Target height for this frame
        const targetH = Math.max(MIN_BAR_HEIGHT, baseHeight + audioHeight);

        // Per-bar smoothing (spring-like, bars rise fast, fall slower)
        const isRising = targetH > heights[i];
        const barSf = 1 - Math.exp(-dt * (isRising ? 18 : 6));
        heights[i] = lerp(heights[i], targetH, barSf);
      }

      // ── Draw bars (mirrored: up and down from center) ──────────────────
      ctx.globalCompositeOperation = isDark ? "lighter" : "source-over";

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (barWidth + BAR_GAP);
        const barH = heights[i];
        const normalizedI = i / (BAR_COUNT - 1);
        const centerDist = Math.abs(normalizedI - 0.5) * 2;

        // Per-bar alternating colors
        const startColor = i % 2 === 0 ? colors.barStart : colors.altStart;
        const endColor = i % 2 === 0 ? colors.barEnd : colors.altEnd;

        // Blend from start to end based on height
        const heightRatio = Math.min(1, barH / maxBarH);
        const r = lerp(startColor[0], endColor[0], heightRatio);
        const g = lerp(startColor[1], endColor[1], heightRatio);
        const b = lerp(startColor[2], endColor[2], heightRatio);

        // Opacity: fade edges, boost center
        const edgeAlpha = 1 - Math.pow(centerDist, 3) * 0.7;
        const alpha = (isDark ? 0.65 : 0.45) * edgeAlpha;

        // Glow behind bar (soft, larger)
        if (barH > 6 && isDark) {
          const [gr, gg, gb] = colors.glow;
          const glowAlpha = alpha * 0.15 * heightRatio;
          ctx.fillStyle = `rgba(${gr | 0}, ${gg | 0}, ${gb | 0}, ${glowAlpha})`;
          const glowPad = barWidth * 2;
          drawBar(
            x - glowPad / 2,
            h - barH - glowPad / 2,
            barWidth + glowPad,
            barH + glowPad,
            BAR_RADIUS + 4,
          );
        }

        // Create vertical gradient for the bar
        const grad = ctx.createLinearGradient(x, h - barH, x, h);
        grad.addColorStop(0, `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`);
        grad.addColorStop(
          0.5,
          `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha * 0.7})`,
        );
        grad.addColorStop(
          1,
          `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha * 0.1})`,
        );

        // Draw bar from bottom up
        ctx.fillStyle = grad;
        drawBar(x, h - barH, barWidth, barH, BAR_RADIUS);
      }

      // ── Thin bottom line ───────────────────────────────────────────────
      const [lr, lg, lb] = colors.glow;
      const lineAlpha = isDark ? 0.15 : 0.1;
      const lineGrad = ctx.createLinearGradient(0, h, w, h);
      lineGrad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, 0)`);
      lineGrad.addColorStop(0.2, `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha})`);
      lineGrad.addColorStop(
        0.5,
        `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha * 1.5})`,
      );
      lineGrad.addColorStop(0.8, `rgba(${lr}, ${lg}, ${lb}, ${lineAlpha})`);
      lineGrad.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, 0)`);
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, h - 2, w, 2);

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [noise2D, isDark]);

  useEffect(() => {
    const cleanup = animate();
    return () => {
      cleanup?.();
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ willChange: "transform" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ display: "block" }}
      />
    </div>
  );
};

export default React.memo(AudioVisualizerCanvas);
