"use client";
import { ArrowLeft } from "lucide-react";
import { memo } from "react";

interface CheckoutHeaderProps {
  step: 1 | 2 | 3 | 4;
  onBack: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Choose Amount",
  2: "Select Payment Method",
  3: "Complete Payment",
};

export const CheckoutHeader = memo(function CheckoutHeader({
  step,
  onBack,
}: CheckoutHeaderProps) {

  if (step >= 4) return null;

  return (
    <div className="flex items-center gap-4 border-b border-slate-400/50 pb-5 mb-8">
      {step !==1 && <button
        onClick={onBack}
        aria-label="Go back"
        className="p-2 hover:bg-slate-500/10 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>}
      <div>
        <h3 className="font-bold text-2xl text-foreground tracking-tight">
          Add Funds
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5 font-medium">
          Step {step} of 3 &bull; {STEP_LABELS[step]}
        </p>
      </div>
    </div>
  );
});
