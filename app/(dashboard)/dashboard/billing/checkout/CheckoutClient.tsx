"use client";

import { FC, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Appearance } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import {
  initiateStripePayment,
} from "@/lib/actions/wallet";
import {
  verifyPhoneNumber,
  initiateCheckoutPayment,
} from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";
import { getStripe } from "@/lib/stripe-client";
import { parseUgandanNumber } from "@/utils";

// Sub-components
import { CheckoutHeader } from "./CheckoutHeader";
import { StepAmount } from "./StepAmount";
import { StepMethod } from "./StepMethod";
import { StepMobileMoney } from "./StepMobileMoney";
// import { StepPolling } from "./StepPolling";
import { OrderSummary } from "./OrderSummary";
import { TrustCenter } from "./TrustCenter";
import { StripePaymentForm } from "./StripePaymentForm";

// Zustand persisted store
import { useCheckoutStore, PaymentMethodType } from "@/store/checkout";
import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";

const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#4f46e5",
    colorBackground: "#0f172a",
    colorText: "#ffffff",
    colorDanger: "#ef4444",
    fontFamily: "Inter, system-ui, sans-serif",
    spacingUnit: "4px",
    borderRadius: "16px",
  },
  rules: {
    ".Input": {
      border: "1px solid #1e293b",
      backgroundColor: "#1e293b",
      padding: "12px",
    },
  },
};

// type ChecklistItem = { label: string; done: boolean; loading: boolean };

interface Props {
  user: User;
  balance: number;
}

export const CheckoutClient: FC<Props> = ({ user, balance }) => {
  const router = useRouter();

  // ── Persisted state (survives page refresh via sessionStorage) ──────────
  const {
    step, setStep,
    amount, setAmount,
    paymentMethod, setPaymentMethod,
    phoneNumber, setPhoneNumber,
    idempotencyKey, setIdempotencyKey,
    goBack, resetCheckout,
  } = useCheckoutStore();

  // ── Sensitive/transient state (never persisted) ─────────────────────────
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string>("");
  const [stripePromise] = useState(() => getStripe());

  // Phone Verification States
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rehydrate Zustand from sessionStorage on first mount
  useEffect(() => {
    useCheckoutStore.persist.rehydrate();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const resetVerification = useCallback(() => {
    setVerifiedName(null);
    setVerifyError(null);
  }, []);

  // ── Amount handlers ─────────────────────────────────────────────────────
  const handleAmountSelect = useCallback(
    (valInUsd: number) => setAmount(valInUsd * USD_TO_UGX_EXCHANGE_RATE),
    [setAmount]
  );

  const handleCustomAmountChange = useCallback(
    (valInUgx: string) => {
      if (valInUgx === "") {
        setAmount(0);
        return;
      }
      const parsed = parseFloat(valInUgx);
      if (!isNaN(parsed)) setAmount(parsed);
    },
    [setAmount]
  );

  const validateAmount = (method?: PaymentMethodType): boolean => {
    if (!method) {
      if (amount < 1000) {
        toast.error("Minimum amount is 1,000 UGX");
        return false;
      }
      if (amount > 70000000) {
        toast.error("Maximum amount is 70,000,000 UGX");
        return false;
      }
      return true;
    }

    if (method === "mobile_money") {
      if (amount < 1000) {
        toast.error("Mobile Money minimum is 1,000 UGX");
        return false;
      }
      if (amount > 7000000) {
        toast.error("Mobile Money maximum is 7,000,000 UGX");
        return false;
      }
    } else if (method === "card") {
      if (amount < 10000) {
        toast.error("Stripe card minimum is 10,000 UGX");
        return false;
      }
      if (amount > 70000000) {
        toast.error("Stripe card maximum is 70,000,000 UGX");
        return false;
      }
    }
    return true;
  };

  // ── Navigation handlers ─────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (step === 1) {
      resetCheckout();
      router.push("/dashboard/billing");
    } else {
      resetVerification();
      goBack();
    }
  }, [step, goBack, resetCheckout, router, resetVerification]);

  const handleProceedToMethod = useCallback(() => {
    if (!validateAmount()) return;
    setStep(2);
  }, [amount, setStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProceedToDetails = useCallback(async () => {
    if (!validateAmount(paymentMethod)) return;
    if (paymentMethod === "card") {
      setIsProcessing(true);
      try {
        const res = await initiateStripePayment(user.id, amount / USD_TO_UGX_EXCHANGE_RATE);
        if (res.success && res.clientSecret && res.transactionId) {
          setClientSecret(res.clientSecret);
          setTxRef(res.reference ?? "");
          setStep(3);
        } else {
          toast.error(res.message || "Failed to initialize Stripe Payment");
        }
      } catch {
        toast.error("Network error while connecting to Stripe");
      } finally {
        setIsProcessing(false);
      }
    } else {
      setStep(3);
    }
  }, [paymentMethod, user.id, amount, setStep]);

  // ── Mobile Money Verification & Initiation ──────────────────────────────
  const handleVerifyPhone = useCallback(async () => {
    setVerifyError(null);
    const parsed = parseUgandanNumber(phoneNumber);
    if (!parsed.isValid) {
      setVerifyError(parsed.error ?? "Invalid phone number format");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyPhoneNumber(parsed.formattedNumber!);
      if (res.success && 'data' in res ) {
        setVerifiedName(res.data?.fullName || null);
      } else {
        setVerifyError("Phone number verification failed.");
      }
    } catch {
      setVerifyError("Network error verifying phone number");
    } finally {
      setIsVerifying(false);
    }
  }, [phoneNumber]);

  const handleInitiateMobileMoney = useCallback(async () => {
    const parsed = parseUgandanNumber(phoneNumber);
    if (!parsed.isValid) {
      toast.error(parsed.error ?? "Invalid phone number format");
      return;
    }

    const currentKey = idempotencyKey ?? crypto.randomUUID();
    if (!idempotencyKey) {
      setIdempotencyKey(currentKey);
    }

    setIsProcessing(true);
    try {
      const res = await initiateCheckoutPayment({
        userId: user.id,
        msisdn: parsed.formattedNumber!,
        amount,
        userName: verifiedName || undefined,
        idempotencyKey: currentKey,
      });

      if (res.success) {
        setIdempotencyKey(null);
        resetCheckout();
        resetVerification();
        router.push(`/dashboard/billing/checkout/waiting?ref=${res.data.reference}`);
      } else {
        if (res.terminal) {
          setIdempotencyKey(null);
        }
        toast.error(res.error || "Failed to initialize Mobile Money");
      }
    } catch {
      toast.error("Error connecting to Mobile Money gateway");
    } finally {
      setIsProcessing(false);
    }
  }, [user.id, amount, phoneNumber, verifiedName, idempotencyKey, setIdempotencyKey, resetCheckout, resetVerification, router]);

  // ── Stripe success callback ─────────────────────────────────────────────
  const handleStripeSuccess = useCallback(
    (reference: string) => {
      resetCheckout();
      router.push(`/dashboard/billing/success?ref=${reference}`);
    },
    [resetCheckout, router]
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
      {/* ── Left Column: Interactive Flow ── */}
      <div className="lg:col-span-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3 p-2 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md min-h-[500px] flex flex-col"
        >
          {/* Background gradients */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

          <CheckoutHeader step={step} onBack={handleBack} />

          <div className="flex-1 flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepAmount
                  amount={amount}
                  onAmountSelect={handleAmountSelect}
                  onCustomAmountChange={handleCustomAmountChange}
                  onContinue={handleProceedToMethod}
                />
              )}

              {step === 2 && (
                <StepMethod
                  paymentMethod={paymentMethod}
                  amount={amount}
                  isProcessing={isProcessing}
                  onSelectMethod={setPaymentMethod}
                  onContinue={handleProceedToDetails}
                />
              )}

              {step === 3 && paymentMethod === "mobile_money" && (
                <motion.div
                  key="step3-momo"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col justify-between"
                >
                  <StepMobileMoney
                    phoneNumber={phoneNumber}
                    amount={amount}
                    isProcessing={isProcessing}
                    isVerifying={isVerifying}
                    verifiedName={verifiedName}
                    verifyError={verifyError}
                    onPhoneChange={setPhoneNumber}
                    onVerify={handleVerifyPhone}
                    onConfirm={handleInitiateMobileMoney}
                    onChangeNumber={resetVerification}
                  />
                </motion.div>
              )}

              {step === 3 && paymentMethod === "card" && clientSecret && (
                <motion.div
                  key="step3-stripe"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-2 md:p-8 shadow-xl border border-gray-100 dark:border-slate-800"
                >
                  <Elements
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
                  >
                    <StripePaymentForm
                      amount={amount}
                      transactionReference={txRef}
                      onCancel={() => setStep(1)}
                      onSuccess={handleStripeSuccess}
                    />
                  </Elements>
                </motion.div>
              )}

              {/* {step === 4 && (
                <StepPolling
                  paymentMethod={paymentMethod}
                  statusChecklist={statusChecklist}
                />
              )} */}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── Right Column: Summary + Trust ── */}
      <div className="lg:col-span-4 space-y-6 lg:pt-0 pt-2">
        <OrderSummary balance={balance} amount={amount} />
        <TrustCenter />
      </div>
    </div>
  );
};
