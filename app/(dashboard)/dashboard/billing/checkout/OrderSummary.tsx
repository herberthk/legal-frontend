"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { formatUSD } from "@/utils";
import { useCheckoutStore } from "@/store/checkout";
import { MOBILE_MONEY_FEE_PERCENTAGE, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

interface OrderSummaryProps {
  balance: number;
  amount: number; // amount is now in UGX
}

export const OrderSummary = memo(function OrderSummary({
  balance,
  amount,
}: OrderSummaryProps) {
  const { paymentMethod } = useCheckoutStore();

  const isMobile = paymentMethod === "mobile_money";
  
  // Calculate amounts in UGX
  const amountUgx = amount || 0;
  const feeUgx = isMobile ? Math.round(amountUgx * MOBILE_MONEY_FEE_PERCENTAGE) : 0;
  const totalUgx = amountUgx + feeUgx;

  // Convert to USD equivalents
  const amountUsd = amountUgx / USD_TO_UGX_EXCHANGE_RATE;
  const feeUsd = feeUgx / USD_TO_UGX_EXCHANGE_RATE;
  const totalUsd = totalUgx / USD_TO_UGX_EXCHANGE_RATE;

  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      className="sticky top-8 backdrop-blur-2xl shadow-xl rounded-3xl p-6 transition-all duration-300 ease-in-out bg-slate-900 border border-slate-800"
    >
      <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl">
          <Wallet className="h-5 w-5 text-indigo-400" />
        </div>
        <h4 className="font-bold text-xl text-foreground tracking-tight">
          Summary
        </h4>
      </div>

      <div className="py-6 space-y-5">
        {/* Current Balance */}
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Current Balance</span>
          <span className="text-foreground">{formatUSD(balance / 100)}</span>
        </div>

        {/* Top-up Amount */}
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted-foreground">Top-up Amount</span>
          <div className="text-right">
            <span className="text-foreground font-bold">{formatUSD(amountUsd)}</span>
            <div className="text-[10px] text-muted-foreground">
              UGX {amountUgx.toLocaleString("en-UG")}
            </div>
          </div>
        </div>

        {/* Ssentezo Fee (2.5%) for Mobile Money */}
        {isMobile && amountUgx > 0 && (
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-muted-foreground">Transaction Fee (2.5%)</span>
            <div className="text-right">
              <span className="text-orange-400 font-bold">{formatUSD(feeUsd)}</span>
              <div className="text-[10px] text-orange-400/80">
                + UGX {feeUgx.toLocaleString("en-UG")}
              </div>
            </div>
          </div>
        )}

        {/* Total to be Paid */}
        <div className="pt-5 mt-2 border-t border-slate-800 flex justify-between items-center">
          <span className="font-bold text-foreground">Total:</span>
          <div className="text-right">
            <span className="font-black text-2xl bg-clip-text text-transparent bg-linear-to-r from-indigo-400 to-orange-400">
              {formatUSD(totalUsd)}
            </span>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">
              UGX {totalUgx.toLocaleString("en-UG")}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

