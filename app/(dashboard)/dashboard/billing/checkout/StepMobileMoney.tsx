"use client";
import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { formatUgx, formatUSD } from "@/utils";
import type { NetworkType } from "@/store/checkout";

interface StepMobileMoneyProps {
  network: NetworkType;
  phoneNumber: string;
  amount: number;
  isProcessing: boolean;
  onSelectNetwork: (network: NetworkType) => void;
  onPhoneChange: (digits: string) => void;
  onSubmit: () => void;
}

export const StepMobileMoney = memo(function StepMobileMoney({
  network,
  phoneNumber,
  amount,
  isProcessing,
  onSelectNetwork,
  onPhoneChange,
  onSubmit,
}: StepMobileMoneyProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowedKeys.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    onPhoneChange(digits);
  }, [onPhoneChange]);

  return (
    <div className="space-y-8 flex-1 flex flex-col justify-between">
      <div className="space-y-8">
        {/* Network Selector */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Select Network Provider
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* MTN */}
            <button
              onClick={() => onSelectNetwork("MTN")}
              className={`p-5 rounded-2xl text-center transition-all relative overflow-hidden group ${
                network === "MTN"
                  ? "bg-yellow-500/10 shadow-lg shadow-yellow-500/20"
                  : "bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <span className={`font-extrabold text-base block mb-1 tracking-tight ${network === "MTN" ? "text-yellow-500" : ""}`}>
                MTN MoMo
              </span>
              <span className="text-[11px] font-medium opacity-80">Direct push USSD prompt</span>
              {network === "MTN" && (
                <motion.div
                  layoutId="networkDot"
                  className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                />
              )}
            </button>

            {/* Airtel */}
            <button
              onClick={() => onSelectNetwork("AIRTEL")}
              className={`p-5 rounded-2xl text-center transition-all relative overflow-hidden group ${
                network === "AIRTEL"
                  ? "bg-red-500/10 shadow-lg shadow-red-500/20"
                  : "bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <span className={`font-extrabold text-base block mb-1 tracking-tight ${network === "AIRTEL" ? "text-red-500" : ""}`}>
                Airtel Money
              </span>
              <span className="text-[11px] font-medium opacity-80">Direct push USSD prompt</span>
              {network === "AIRTEL" && (
                <motion.div
                  layoutId="networkDot"
                  className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                />
              )}
            </button>
          </div>
        </div>

        {/* Phone Number Input */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Enter Phone Number
          </label>
          <div className="relative rounded-full shadow-2xl px-12 py-4 border border-slate-400/30">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold select-none pr-3">
              +256
            </div>
            <input
              maxLength={9}
              minLength={9}
              placeholder={network === "AIRTEL" ? "701 234567" : "771 234567"}
              value={phoneNumber}
              onKeyDown={handleKeyDown}
              onChange={handleChange}
              inputMode="numeric"
              className="ml-8 bg-transparent border-none outline-none focus:ring-0 text-foreground font-bold text-lg w-full placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mt-3 px-1 flex items-start gap-2">
            <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
            A USSD PIN prompt will pop up on this phone to complete the payment.
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-6 mt-8 flex items-center justify-between gap-4">
        <CustomButton
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest"
          hoverEffect="glow"
          disabled={isProcessing}
          fullWidth
          isLoading={isProcessing}
          onClick={onSubmit}
        >
          Topup {formatUSD(amount)} ({formatUgx(amount)})
        </CustomButton>
      </div>
    </div>
  );
});
