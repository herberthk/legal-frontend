"use client";

import { useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneCall,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useTransactionStatus } from "@/lib/ssentezo/hooks";
import { CustomButton } from "@/components/ui/custom-button";

interface WaitingClientProps {
  reference: string;
}

export const WaitingClient = memo(function WaitingClient({ reference }: WaitingClientProps) {
  const router = useRouter();
  const [showInstructions, setShowInstructions] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Poll status from our status API every 7s with max timeout of 3 minutes (180,000ms)
  const { pollingState, transactionStatus, error, startPolling } = useTransactionStatus({
    intervalMs: 7000,
    maxWaitMs: 180000,
    onTerminal: (status) => {
      if (status === "SUCCEEDED") {
        router.push(`/dashboard/billing/success?ref=${reference}`);
      }
    },
  });

  // Start polling immediately when component mounts
  useEffect(() => {
    if (reference) {
      startPolling(reference);
    }
  }, [reference, startPolling]);

  // Seconds elapsed counter for active polling phase
  useEffect(() => {
    if (pollingState !== "polling") return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [pollingState]);

  // Terminal states mapping
  const isFailed =
    pollingState === "failed" ||
    pollingState === "timeout" ||
    pollingState === "error" ||
    pollingState === "indeterminate";

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background radial effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* ── Polling / Pending State ── */}
        {!isFailed && (
          <motion.div
            key="polling"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col justify-center items-center text-center space-y-6"
          >
            {/* Animated pulsing rings */}
            <div className="relative flex justify-center items-center h-28 w-28">
              <div className="absolute h-28 w-28 rounded-full border-2 border-indigo-500/20 animate-ping duration-1000" />
              <div className="absolute h-20 w-20 rounded-full border-2 border-orange-500/20 animate-ping duration-1500" />
              <div className="p-5 rounded-full bg-slate-800/80 shadow-xl relative z-10">
                <PhoneCall className="h-10 w-10 text-orange-400 animate-pulse duration-1000" />
              </div>
            </div>

            {/* Message info */}
            <div>
              <h4 className="font-extrabold text-2xl text-foreground tracking-tight">
                Check your phone
              </h4>
              <p className="text-sm text-muted-foreground mt-2 max-w-[320px] mx-auto leading-relaxed">
                We sent a secure USSD PIN request. Please unlock your device and enter your Mobile Money PIN.
              </p>
            </div>

            {/* Live Indicator */}
            <div className="flex flex-col items-center gap-1.5 bg-slate-800/40 border border-slate-700/30 px-4 py-2.5 rounded-full min-w-[200px]">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-xs font-bold text-foreground uppercase tracking-widest">
                  Waiting for PIN…
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                Elapsed: {elapsedSeconds}s (max 3 mins)
              </span>
            </div>

            {/* Interactive collapse instructions */}
            <div className="w-full border-t border-slate-800 pt-4 text-left">
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider py-1.5 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
                  No prompt on your screen?
                </span>
                {showInstructions ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              <AnimatePresence>
                {showInstructions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="text-xs text-muted-foreground space-y-2 mt-3 pl-5 list-decimal border-l border-indigo-500/20 leading-relaxed font-medium">
                      <p>1. Make sure your device has a strong cellular network connection.</p>
                      <p>
                        2. If no menu appears, check your carrier&apos;s pending approvals menu manually:
                      </p>
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 my-1">
                        <div>
                          <span className="text-yellow-400">MTN:</span> Dial <span className="text-foreground">*165*8#</span> &rarr; My Approvals
                        </div>
                        <div>
                          <span className="text-red-400">Airtel:</span> Dial <span className="text-foreground">*185*4#</span> &rarr; My Account &rarr; Pending Approvals
                        </div>
                      </div>
                      <p>
                        3. Don&apos;t worry, if you miss the prompt or cancel, you can safely try again below.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Failed / Error State ── */}
        {isFailed && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col justify-center items-center text-center space-y-6"
          >
            {/* Failure Icon */}
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 shadow-lg">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>

            {/* Error Message */}
            <div>
              <h4 className="font-extrabold text-2xl text-foreground tracking-tight">
                Payment Verification Timeout
              </h4>
              <p className="text-sm text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
                {error ||
                  "The transaction request timed out, was canceled, or rejected by your provider. No funds were debited."}
              </p>
            </div>

            {/* CTA Retry */}
            <div className="w-full space-y-3 pt-2">
              <CustomButton
                variant="transparent"
                shape="pill"
                borderLeftWidth="4px"
                borderLeftColor="#ef4444"
                borderRightWidth="4px"
                borderRightColor="#f97316"
                className="bg-slate-800/80 uppercase tracking-widest text-xs font-bold"
                hoverEffect="glow"
                fullWidth
                onClick={() => router.push("/dashboard/billing/checkout")}
              >
                Try Again
              </CustomButton>

              <button
                type="button"
                onClick={() => router.push("/dashboard/billing")}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider py-2 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Billing
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
