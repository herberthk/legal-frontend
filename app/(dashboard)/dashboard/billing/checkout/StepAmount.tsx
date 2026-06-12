"use client";
import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { Input } from "@/components/ui/input";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

const PRESET_AMOUNTS = [10, 20, 50, 100] as const;

interface StepAmountProps {
  amount: number; // amount is in UGX
  onAmountSelect: (valInUsd: number) => void;
  onCustomAmountChange: (valInUgx: string) => void;
  onContinue: () => void;
}

export const StepAmount = memo(function StepAmount({
  amount,
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
            {PRESET_AMOUNTS.map((val) => {
              const presetUgx = val * USD_TO_UGX_EXCHANGE_RATE;
              const isSelected = Math.round(amount / 100) === Math.round(presetUgx / 100);

              return (
                <button
                  key={val}
                  onClick={() => onCustomAmountChange(String(presetUgx))}
                  className={`py-4 px-2 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-1.5 overflow-hidden relative group ${
                    isSelected
                      ? "bg-indigo-600/15 text-indigo-300 shadow-lg shadow-indigo-600/20 scale-105 border border-indigo-500/30"
                      : "bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  <span
                    className={`text-xl font-bold ${isSelected ? "text-indigo-400" : ""}`}
                  >
                    ${val}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground/80">
                    {presetUgx.toLocaleString("en-UG")} UGX
                  </span>
                  {/* Hover flare */}
                  <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Enter Amount (UGX)
          </label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-extrabold text-sm tracking-widest select-none">
              UGX
            </span>
            <Input
              inputMode="numeric"
              placeholder="10,000"
              value={amount === 0 ? "" : String(amount)}
              onChange={handleCustomChange}
              className="py-6 pl-16 pr-5 bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-foreground font-semibold text-lg rounded-full transition-all border border-slate-700/30 focus:border-indigo-500/50"
            />
          </div>
          {amount > 0 && (
            <p className="text-xs text-indigo-400 mt-2 font-medium px-2">
              Equivalent to: ${(amount / USD_TO_UGX_EXCHANGE_RATE).toFixed(2)} USD
            </p>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <p className="text-xs text-muted-foreground max-w-[250px] font-medium leading-relaxed">
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
