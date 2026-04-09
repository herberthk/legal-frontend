"use client";

import { useState } from "react";
import { CustomButton } from "./custom-button";
import { Trash2, Sparkles, ArrowRight, Plus } from "lucide-react";

export function ButtonPreview() {
  const [isLoading, setIsLoading] = useState(false);

  const toggleLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="p-8 space-y-12 max-w-5xl mx-auto bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Custom Button Component
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          A highly configurable button system built with Framer Motion and
          Tailwind CSS.
        </p>
      </div>

      {/* Variants Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">Variants</h2>
        <div className="flex flex-wrap gap-4">
          <CustomButton variant="primary">Primary (Indigo)</CustomButton>
          <CustomButton variant="secondary">Secondary (Orange)</CustomButton>
          <CustomButton variant="white">White</CustomButton>
          <CustomButton variant="danger" leftIcon={<Trash2 />}>
            Danger
          </CustomButton>
          <CustomButton variant="outline">Outline</CustomButton>
          <CustomButton variant="ghost">Ghost</CustomButton>
          <CustomButton shape="pill" variant="transparent">
            Transparent
          </CustomButton>
        </div>
      </section>

      {/* Gradients Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">Gradients</h2>
        <div className="flex flex-wrap gap-4">
          <CustomButton variant="gradient-indigo" leftIcon={<Sparkles />}>
            Gradient Indigo
          </CustomButton>
          <CustomButton variant="gradient-orange" rightIcon={<ArrowRight />}>
            Gradient Orange
          </CustomButton>
          <CustomButton variant="gradient-mixed" animation="pulse">
            Gradient Mixed
          </CustomButton>
        </div>
      </section>

      {/* Sizes Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">Sizes & Shapes</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <CustomButton size="sm">Small</CustomButton>
            <CustomButton size="md">Medium (Default)</CustomButton>
            <CustomButton size="lg">Large</CustomButton>
          </div>
          <div className="flex items-center gap-4">
            <CustomButton shape="square">Square</CustomButton>
            <CustomButton shape="rounded">Rounded (Default)</CustomButton>
            <CustomButton shape="pill" leftIcon={<Plus />}>
              Pill Shape
            </CustomButton>
          </div>
        </div>
      </section>

      {/* States Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">
          States & Interactions
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <CustomButton
            isLoading={isLoading}
            onClick={toggleLoading}
            variant="primary"
          >
            Click to Load
          </CustomButton>
          <CustomButton disabled variant="primary">
            Disabled Button
          </CustomButton>
          <CustomButton variant="outline" shadow="lg">
            Large Shadow
          </CustomButton>
          <CustomButton variant="secondary" fullWidth={false} className="w-64">
            Fixed Width (256px)
          </CustomButton>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <CustomButton fullWidth variant="gradient-mixed">
            Full Width Mixed Gradient
          </CustomButton>
        </div>
      </section>

      {/* Animations & Transitions Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">
          Animations & Transitions
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="space-y-4 w-full">
            <h3 className="text-sm text-slate-500 font-medium">
              Continuous Animations
            </h3>
            <div className="flex gap-4">
              <CustomButton animation="pulse" variant="primary">
                Pulse Animation
              </CustomButton>
              <CustomButton animation="bounce" variant="secondary">
                Bounce Animation
              </CustomButton>
            </div>
          </div>

          <div className="space-y-4 w-full pt-4">
            <h3 className="text-sm text-slate-500 font-medium">
              Content Transitions (on state change)
            </h3>
            <div className="flex gap-4">
              <CustomButton transitionType="fade" variant="outline">
                Fade Transition
              </CustomButton>
              <CustomButton transitionType="slide" variant="outline">
                Slide Transition
              </CustomButton>
              <CustomButton transitionType="zoom" variant="outline">
                Zoom Transition
              </CustomButton>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Borders Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">
          Advanced Borders (Angles & Sides)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Individual Side Colors</p>
            <CustomButton
              variant="transparent"
              borderTopWidth="3px"
              borderTopColor="#4f46e5"
              borderRightWidth="3px"
              borderRightColor="#ea580c"
              borderBottomWidth="3px"
              borderBottomColor="#4f46e5"
              borderLeftWidth="3px"
              borderLeftColor="#ea580c"
              className="bg-slate-50 dark:bg-slate-900"
            >
              Multi-colored Edges
            </CustomButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              Asymmetric Corners (Angles)
            </p>
            <CustomButton
              variant="primary"
              borderTopLeftRadius="24px"
              borderBottomRightRadius="24px"
              borderTopRightRadius="4px"
              borderBottomLeftRadius="4px"
            >
              Leaf Shape
            </CustomButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-500">Sidebar / Indicator Style</p>
            <CustomButton
              variant="white"
              borderLeftWidth="6px"
              borderLeftColor="#4f46e5"
              shape="square"
            >
              Left Accent
            </CustomButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              Bilateral Borders (Requested)
            </p>
            <div className="flex gap-3">
              <CustomButton
                isLoading={true}
                variant="transparent"
                shape="rounded"
                borderLeftWidth="4px"
                borderLeftColor="#4f46e5"
                borderRightWidth="4px"
                borderRightColor="#ea580c"
                className="bg-slate-100/50 dark:bg-slate-800/50"
              >
                Rounded button
              </CustomButton>

              <CustomButton
                variant="transparent"
                shape="pill"
                borderLeftWidth="4px"
                borderLeftColor="#4f46e5"
                borderRightWidth="4px"
                borderRightColor="#ea580c"
                className="bg-slate-100/50 dark:bg-slate-800/50"
                leftIcon={<Sparkles />}
              >
                Pill button
              </CustomButton>

              {/* <CustomButton
                variant="transparent"
                borderTopLeftRadius="20px"
                borderBottomRightRadius="20px"
                borderTopWidth="3px"
                borderTopColor="#4f46e5"
                borderLeftWidth="3px"
                borderLeftColor="#ea580c"
                borderBottomWidth="3px"
                borderBottomColor="#ea580c"
                borderRightWidth="3px"
                borderRightColor="#4f46e5"
                className="bg-slate-100/50 dark:bg-slate-800/50 min-w-[140px]"
              >
                Diagonal Custom
              </CustomButton> */}
            </div>
          </div>
        </div>
      </section>

      {/* Premium Hover Effects Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">
          Premium Hover Effects
        </h2>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Inner Shine Sweep</p>
            <CustomButton
              variant="gradient-indigo"
              hoverEffect="shine"
              size="lg"
            >
              Shine Effect
            </CustomButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-500">Outer Indigo Glow</p>
            <CustomButton variant="primary" hoverEffect="glow">
              Glow Effect
            </CustomButton>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-500">Interactive 3D Tilt</p>
            <CustomButton variant="secondary" hoverEffect="tilt">
              Tilt Perspective
            </CustomButton>
          </div>
        </div>
      </section>

      {/* Custom Extensibility Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold border-b pb-2">
          Custom Extensibility
        </h2>
        <div className="flex flex-wrap gap-4">
          <CustomButton
            onClick={() => alert("Custom Click Event!")}
            className="bg-teal-600 hover:bg-teal-700 uppercase tracking-widest text-xs"
            style={{ boxShadow: "0 0 20px rgba(13, 148, 136, 0.4)" }}
          >
            Custom Teal (External Class & Style)
          </CustomButton>
        </div>
      </section>
    </div>
  );
}
