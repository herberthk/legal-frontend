"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { formatUSD, formatUgx } from "@/utils";

interface OrderSummaryProps {
  balance: number;
  amount: number;
}

export const OrderSummary = memo(function OrderSummary({
  balance,
  amount,
}: OrderSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      className="sticky top-8 backdrop-blur-2xl shadow-xl rounded-3xl p-6 transition-all duration-300 ease-in-out"
    >
      <div className="flex items-center gap-3 border-b border-slate-400/50 pb-5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl">
          <Wallet className="h-5 w-5 text-indigo-400" />
        </div>
        <h4 className="font-bold text-xl text-foreground tracking-tight">
          Summary
        </h4>
      </div>

      <div className="py-6 space-y-5">
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Current Balance</span>
          <span className="text-foreground">{formatUSD(balance / 100)}</span>
        </div>

        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Top-up Amount</span>
          <span className="text-foreground">{formatUSD(amount)}</span>
        </div>

        {amount > 0 && (
          <div className="flex justify-between items-center text-[13px] font-medium">
            <span className="text-muted-foreground/70">Local Equivalent</span>
            <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
              {formatUgx(amount)}
            </span>
          </div>
        )}

        <div className="pt-5 mt-2 border-t border-slate-400/50 flex justify-between items-center">
          <span className="font-bold text-foreground">Total:</span>
          <span className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-orange-400">
            {formatUSD(amount)}
          </span>
        </div>
      </div>
    </motion.div>
  );
});
