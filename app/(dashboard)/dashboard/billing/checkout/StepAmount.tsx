"use client";
import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { Input } from "@/components/ui/input";
import { formatUgx } from "@/utils";

const PRESET_AMOUNTS = [10, 20, 50, 100] as const;

interface StepAmountProps {
  amount: number;
  onAmountSelect: (val: number) => void;
  onCustomAmountChange: (val: string) => void;
  onContinue: () => void;
}

export const StepAmount = memo(function StepAmount({
  amount,
  onAmountSelect,
  onCustomAmountChange,
  onContinue,
}: StepAmountProps) {
  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onCustomAmountChange(e.target.value);
    },
    [onCustomAmountChange]
  );

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 flex-1 flex flex-col justify-between"
    >
      <div className="space-y-8">
        {/* Preset Amounts */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Select Amount (USD)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => onAmountSelect(val)}
                className={`py-4 px-2 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-1.5 overflow-hidden relative group ${
                  amount === val
                    ? "bg-indigo-600/15 text-indigo-300 shadow-lg shadow-indigo-600/20 scale-105"
                    : "bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`text-xl font-bold ${amount === val ? "text-indigo-500" : ""}`}
                >
                  ${val}
                </span>
                <span className="text-[11px] font-medium">
                  ~{formatUgx(val).split(" ")[1] || formatUgx(val)}
                </span>
                {/* Hover flare */}
                <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Enter Amount
          </label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">
              $
            </span>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              min={5}
              max={1000}
              onChange={handleCustomChange}
              className="py-6 px-9 bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-foreground font-semibold text-lg rounded-full transition-all"
            />
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="pt-6 border-t border-slate-400/50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <p className="text-xs text-muted-foreground max-w-[250px] font-medium">
          Funds will be credited to your legal consultation wallet instantly
          upon confirmation.
        </p>
        <CustomButton
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest"
          rightIcon={<ChevronRight className="ml-1" size={20} />}
          hoverEffect="glow"
          onClick={onContinue}
        >
          Continue
        </CustomButton>
      </div>
    </motion.div>
  );
});
