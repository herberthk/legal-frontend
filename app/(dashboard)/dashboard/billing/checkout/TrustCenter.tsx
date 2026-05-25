"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const TrustCenter = memo(function TrustCenter() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-5"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-full bg-emerald-500/10 shrink-0 mt-0.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground tracking-tight">
            Bank-Level Security
          </p>
          <p className="text-xs font-medium text-muted-foreground mt-1 leading-relaxed">
            256-bit SSL encryption ensures your financial data is fully
            protected and never stored on our servers.
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

      <div className="flex items-start gap-4">
        <div className="p-2 rounded-full bg-indigo-500/10 shrink-0 mt-0.5">
          <CheckCircle2 className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground tracking-tight">
            Instant Processing
          </p>
          <p className="text-xs font-medium text-muted-foreground mt-1 leading-relaxed">
            Funds are credited to your legal consultation wallet instantly
            upon successful verification.
          </p>
        </div>
      </div>
    </motion.div>
  );
});
