"use client";

import { memo, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { parseUgandanNumber } from "@/utils";
import { MOBILE_MONEY_FEE_PERCENTAGE, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

interface StepMobileMoneyProps {
  phoneNumber:  string;
  amount:       number; // USD
  isProcessing: boolean;
  isVerifying:  boolean;
  verifiedName: string | null;
  verifyError:  string | null;
  onPhoneChange:    (digits: string) => void;
  onVerify:         () => void;
  onConfirm:        () => void;
  onChangeNumber:   () => void;
}

export const StepMobileMoney = memo(function StepMobileMoney({
  phoneNumber,
  amount,
  isProcessing,
  isVerifying,
  verifiedName,
  verifyError,
  onPhoneChange,
  onVerify,
  onConfirm,
  onChangeNumber,
}: StepMobileMoneyProps) {

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End"];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onPhoneChange(e.target.value.replace(/\D/g, ""));
  }, [onPhoneChange]);

  // Auto-detect network as user types
  const detectedProvider = useMemo(() => {
    if (phoneNumber.length < 2) return null;
    const { provider } = parseUgandanNumber(phoneNumber);
    return provider;
  }, [phoneNumber]);

  // Amount maths
  const amountUSD  = amount / USD_TO_UGX_EXCHANGE_RATE;
  const feeUgx     = amount * MOBILE_MONEY_FEE_PERCENTAGE;
  const feeUSD = feeUgx / USD_TO_UGX_EXCHANGE_RATE;
  const totalUgx   = amount + feeUgx;
  const totalUSD = amountUSD + feeUSD;
  const canVerify  = phoneNumber.length === 9 && !isVerifying && !isProcessing;
console.log("amount in fmobile money final  step", amount)
  return (
    <div className="flex-1 flex flex-col justify-between space-y-6">
      <AnimatePresence mode="wait">

        {/* ── A: Phone Entry ── */}
        {!verifiedName ? (
          <motion.div
            key="phone-entry"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Info banner */}
            <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 px-4 py-3 flex items-start gap-3">
              <Smartphone className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Works with{" "}
                <span className="font-semibold text-yellow-400">MTN MoMo</span> &amp;{" "}
                <span className="font-semibold text-red-400">Airtel Money</span> Uganda.
                Network is auto-detected — no selection needed.
              </p>
            </div>

            {/* Phone input */}
            <div>
              <label
                htmlFor="momo-phone"
                className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3"
              >
                Mobile Money Number
              </label>

              <div className="relative rounded-full shadow-2xl px-5 py-4 border border-slate-400/30 focus-within:border-indigo-500/50 transition-colors">
                {/* Prefix */}
                <div className="absolute left-5 top-1/2 -translate-y-1/2 select-none flex items-center gap-1.5 text-muted-foreground font-bold">
                  <span className="text-base">🇺🇬</span>
                  <span className="text-base">+256</span>
                </div>

                <input
                  id="momo-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={9}
                  placeholder="7X XXX XXXX"
                  value={phoneNumber}
                  onKeyDown={handleKeyDown}
                  onChange={handleChange}
                  className="ml-16 bg-transparent border-none outline-none focus:ring-0 text-foreground font-bold text-base w-full placeholder:text-muted-foreground/40 tracking-widest"
                />

                {/* Provider badge */}
                <AnimatePresence>
                  {detectedProvider && (
                    <motion.span
                      key={detectedProvider}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.75 }}
                      className={`absolute right-5 top-1/2 -translate-y-1/2 text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                        detectedProvider === "MTN"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {detectedProvider}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Error / hint */}
              <AnimatePresence>
                {verifyError ? (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-red-400 text-xs mt-2 px-2"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {verifyError}
                  </motion.p>
                ) : (
                  <motion.p
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-muted-foreground/60 mt-2 px-2"
                  >
                    Enter 9 digits — do not include leading 0 or country code
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Verify button */}
            <CustomButton
              variant="transparent"
              shape="pill"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest"
              hoverEffect="glow"
              disabled={!canVerify}
              fullWidth
              isLoading={isVerifying}
              onClick={onVerify}
            >
              {isVerifying ? "Verifying…" : "Verify Number"}
            </CustomButton>
          </motion.div>
        ) : (

          /* ── B: Confirm ── */
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Verified card */}
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5 flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  Verified Mobile Money Information
                </p>
                <p className="text-xl font-extrabold text-foreground tracking-tight leading-tight">
                  {verifiedName}
                </p>
                <p className="text-sm text-muted-foreground font-medium mt-0.5">
                  +256 {phoneNumber}
                </p>
              </div>
            </div>

            {/* Amount breakdown */}
            <div className="rounded-2xl bg-slate-500/5 border border-slate-500/10 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <div className="text-muted-foreground">Deposit amount</div>
                <div className="flex flex-col">
                    <span className="font-semibold">
                        ${amountUSD.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        UGX {amount.toLocaleString("en-UG")}
                    </span>
                </div>
                
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction fee (2.5%)</span>
                <div className="flex flex-col">
                  <span className="font-semibold text-orange-400">
                   + ${feeUSD.toFixed(2)} 
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                   + UGX {feeUgx.toLocaleString("en-UG")}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-500/20 pt-3 flex justify-between">
                <span className="font-bold text-foreground">Total deducted</span>
                <div className="flex flex-col">
                  <span className="font-extrabold text-foreground text-base">
                   
                    ${totalUSD.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                     UGX {totalUgx.toLocaleString("en-UG")}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground/70 leading-relaxed">
              A USSD prompt will appear on your phone.
              Enter your Mobile Money PIN to confirm.
            </p>

            {/* CTA */}
            <div className="space-y-3">
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
                onClick={onConfirm}
              >
                {isProcessing
                  ? "Initiating payment…"
                  : `Pay $${totalUSD.toFixed(2)} (UGX ${totalUgx.toLocaleString("en-UG")})`}
              </CustomButton>

              <button
                type="button"
                onClick={onChangeNumber}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change number
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
