"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Smartphone, CreditCard, ChevronRight } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { formatUSD, formatUgx } from "@/utils";
import type { PaymentMethodType } from "@/store/checkout";

interface StepMethodProps {
  paymentMethod: PaymentMethodType;
  amount: number;
  isProcessing: boolean;
  onSelectMethod: (method: PaymentMethodType) => void;
  onContinue: () => void;
}

export const StepMethod = memo(function StepMethod({
  paymentMethod,
  amount,
  isProcessing,
  onSelectMethod,
  onContinue,
}: StepMethodProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 flex-1 flex flex-col justify-between"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
          Select Payment Method
        </label>
        <div className="space-y-4">
          {/* Mobile Money */}
          <button
            onClick={() => onSelectMethod("mobile_money")}
            className={`w-full p-5 rounded-2xl text-left transition-all duration-300 flex items-center justify-between gap-4 group overflow-hidden relative ${
              paymentMethod === "mobile_money"
                ? "bg-orange-600/10 shadow-lg shadow-orange-600/20"
                : "bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-5 relative z-10">
              <div
                className={`p-3.5 rounded-xl transition-colors ${
                  paymentMethod === "mobile_money"
                    ? "bg-orange-500/25 text-orange-400"
                    : "bg-slate-800 text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <Smartphone className="h-7 w-7" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base tracking-tight">
                  Mobile Money
                </h4>
                <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                  Instant deposit via MTN MoMo or Airtel Money.
                </p>
              </div>
            </div>
            <div className="h-5 w-5 rounded-full shadow-xl shadow-orange-600/20 flex items-center justify-center relative z-10">
              {paymentMethod === "mobile_money" && (
                <motion.div
                  layoutId="methodDot"
                  className="h-2.5 w-2.5 rounded-full bg-orange-500"
                />
              )}
            </div>
          </button>

          {/* Credit Card */}
          <button
            onClick={() => onSelectMethod("card")}
            className={`w-full p-5 rounded-2xl text-left transition-all duration-300 flex items-center justify-between gap-4 group overflow-hidden relative ${
              paymentMethod === "card"
                ? "bg-indigo-600/10 shadow-xl shadow-indigo-600/20"
                : "bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-5 relative z-10">
              <div
                className={`p-3.5 rounded-xl transition-colors ${
                  paymentMethod === "card"
                    ? "bg-indigo-500/25 text-indigo-400"
                    : "bg-slate-800 text-muted-foreground group-hover:text-foreground"
                }`}
              >
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base tracking-tight">
                  Stripe Credit/Debit Card
                </h4>
                <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                  Pay securely using international card payments.
                </p>
              </div>
            </div>
            <div className="h-5 w-5 rounded-full flex items-center justify-center relative z-10 shadow-xl shadow-indigo-600/20">
              {paymentMethod === "card" && (
                <motion.div
                  layoutId="methodDot"
                  className="h-2.5 w-2.5 rounded-full bg-indigo-500"
                />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-slate-400/50 flex items-center justify-between gap-4 mt-8">
        <p className="text-sm font-medium text-muted-foreground">
          Total:{" "}
          <span className="font-bold text-foreground">
            {formatUSD(amount)} ({formatUgx(amount)})
          </span>
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
          disabled={isProcessing}
          isLoading={isProcessing}
          onClick={onContinue}
        >
          Enter Details
        </CustomButton>
      </div>
    </motion.div>
  );
});
