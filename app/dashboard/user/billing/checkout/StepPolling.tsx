"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, PhoneCall, ShieldCheck } from "lucide-react";
import type { PaymentMethodType } from "@/store/checkout";

interface ChecklistItem {
  label: string;
  done: boolean;
  loading: boolean;
}

interface StepPollingProps {
  paymentMethod: PaymentMethodType;
  statusChecklist: ChecklistItem[];
}

export const StepPolling = memo(function StepPolling({
  paymentMethod,
  statusChecklist,
}: StepPollingProps) {
  const isMobile = paymentMethod === "mobile_money";

  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col justify-center items-center text-center py-6 space-y-8"
    >
      {/* Animated pulsing rings */}
      <div className="relative flex justify-center items-center">
        <div className="absolute h-32 w-32 rounded-full border-2 border-indigo-500/20 animate-ping duration-1000" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-orange-500/20 animate-ping duration-1500" />
        <div className="p-6 rounded-full shadow-lg relative z-10 shadow-2xl backdrop-blur-sm">
          {isMobile ? (
            <PhoneCall className="h-12 w-12 text-orange-400 animate-pulse duration-1000" />
          ) : (
            <ShieldCheck className="h-12 w-12 text-indigo-400 animate-pulse" />
          )}
        </div>
      </div>

      {/* Message */}
      <div>
        <h4 className="font-extrabold text-2xl text-foreground tracking-tight">
          {isMobile ? "Check your phone" : "Verifying Secure Payment"}
        </h4>
        <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
          {isMobile
            ? "A USSD prompt has been sent. Please enter your MoMo PIN to complete the transaction."
            : "Securely authenticating your card transaction. Please do not close or reload the page."}
        </p>
      </div>

      {/* Status checklist */}
      <div className="w-full max-w-sm bg-slate-500/5 shadow-xl rounded-2xl p-5 text-left space-y-4">
        {statusChecklist.map((item, idx) => (
          <div key={idx} className="flex items-center gap-4 text-sm font-medium">
            {item.done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : item.loading ? (
              <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-slate-700 shrink-0" />
            )}
            <span
              className={
                item.done
                  ? "text-muted-foreground line-through decoration-slate-700/50"
                  : item.loading
                    ? "text-foreground"
                    : "text-muted-foreground/50"
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
});
