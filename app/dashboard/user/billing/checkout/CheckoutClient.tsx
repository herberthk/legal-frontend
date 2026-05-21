"use client";

import { FC, useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence
} from "framer-motion";
import {
  Smartphone,
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ShieldCheck,
  PhoneCall,
  Wallet
} from "lucide-react";
import { CustomButton } from "@/components/ui/custom-button";
import { Input } from "@/components/ui/input";
import type { Appearance } from "@stripe/stripe-js";
import {
  Elements} from "@stripe/react-stripe-js";
import {
  initiateStripePayment,
  initiateMobileMoneyPayment,
  getTransactionStatus
} from "@/lib/actions/wallet";
import { toast } from "sonner";
import { useRouter } from "nextjs-toploader/app";
import { getStripe } from "@/lib/stripe-client";
import { formatUgx, formatUSD } from "@/utils";
import { StripePaymentForm } from "./StripePaymentForm";



type Props = {
  user: User;
  balance: number;
};

// --- CheckoutClient Component ---
export const CheckoutClient: FC<Props> = ({
  user,
  balance,
}) => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [amount, setAmount] = useState<number>(20);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">(
    "mobile_money"
  );
  const [network, setNetwork] = useState<"MTN" | "AIRTEL">("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
   const [txRef, setTxRef] = useState<string>("");

  const [stripePromise] = useState(() => getStripe());
  
  // Status Checklist for simulated USSD / Stripe webhook
  const [statusChecklist, setStatusChecklist] = useState<
    { label: string; done: boolean; loading: boolean }[]
  >([]);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleAmountSelect = (val: number) => setAmount(val);
  

  const handleCustomAmountChange = (val: string) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) setAmount(parsed);
  };

  const validateAmount = (): boolean => {
    if (amount < 5) {
      toast.error("Minimum top-up is $5.00");
      return false;
    }
    if (amount > 1000) {
      toast.error("Maximum top-up is $1,000.00");
      return false;
    }
    return true;
  };

  // Move from Amount to payment method selection
  const handleProceedToMethod = () => {
    if (!validateAmount()) return;
    setStep(2);
  };

  // Continue from Method to payment detail forms
  const handleProceedToDetails = async () => {
    if (paymentMethod === "card") {
      setIsProcessing(true);
      try {
        const res = await initiateStripePayment(user.id, amount);
        if (res.success && res.clientSecret && res.transactionId) {
          setClientSecret(res.clientSecret);
          setTransactionId(res.transactionId);
          setTxRef(res.reference);
          setStep(3);
        } else {
          toast.error(res.message || "Failed to initialize Stripe Payment");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error while connecting to Stripe");
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Mobile Money details page
      setStep(3);
    }
  };

  // Start direct Mobile Money payment
  const handleInitiateMobileMoney = async () => {
    // Basic phone validation
    const rawPhone = phoneNumber.replace(/\D/g, "");
    if (rawPhone.length < 9 || rawPhone.length > 12) {
      toast.error("Please enter a valid Ugandan phone number");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await initiateMobileMoneyPayment(
        user.id,
        amount,
        phoneNumber,
        network
      );
      if (res.success && res.transactionId) {
        setTransactionId(res.transactionId);
        startPollingTransaction({txId: res.transactionId, type: "mobile_money",ref: res.reference});
      } else {
        toast.error(res.message || "Failed to initialize Mobile Money");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to Mobile Money gateway");
    } finally {
      setIsProcessing(false);
    }
  };

  // Start polling Firestore status
  const startPollingTransaction = ({txId, type, ref}: {txId: string, type: "card" | "mobile_money",ref: string | null}) => {
    setStep(4);
    
    if (type === "mobile_money") {
      setStatusChecklist([
        { label: "Initiating Mobile Money request", done: true, loading: false },
        { label: "USSD PIN prompt pushed to phone", done: false, loading: true },
        { label: "Waiting for your confirmation PIN", done: false, loading: false },
      ]);
    } else {
      setStatusChecklist([
        { label: "Confirming payment with Stripe", done: true, loading: false },
        { label: "Stripe checkout successful", done: true, loading: false },
        { label: "Waiting for secure webhook receipt", done: false, loading: true },
      ]);
    }

    let pollCount = 0;
    pollIntervalRef.current = setInterval(async () => {
      pollCount++;
      try {
        const res = await getTransactionStatus(txId);
        if (res.success && res.status === "completed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          
          setStatusChecklist((prev) => prev.map((item) => ({ ...item, done: true, loading: false })));
          
          setTimeout(() => {
            router.push(`/dashboard/user/billing/success?ref=${ref}`);
          }, 800);
        } else if (res.success && res.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          toast.error("Transaction failed or was canceled by user.");
          setStep(3);
        } else {
          if (type === "mobile_money") {
            if (pollCount === 2) {
              setStatusChecklist([
                { label: "Initiating Mobile Money request", done: true, loading: false },
                { label: "USSD PIN prompt pushed to phone", done: true, loading: false },
                { label: "Waiting for your confirmation PIN", done: false, loading: true },
              ]);
            }
          }
        }

        if (pollCount >= 14) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          toast.info("Payment submitted! Processing in the background.");
          router.push('/dashboard/user/billing');
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);
  };

  const handleStripeSuccess = () => {
    if (transactionId) {
      startPollingTransaction({txId: transactionId, type: "card", ref: txRef});
    }
  };

  const handleStripeFailure = (msg: string) => {
    toast.error(msg);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
      {/* Left Column: Interactive Flow */}
      <div className="lg:col-span-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className=" rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md min-h-[500px] flex flex-col"
        >
          {/* Background gradients */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Header */}
          {step < 4 && (
            <div className="flex items-center gap-4 border-b border-slate-400/50 pb-5 mb-8">
              <button
                onClick={() => {
                  if (step === 1) router.push('/dashboard/user/billing');
                  else setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
                }}
                className="p-2 hover:bg-slate-500/10 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h3 className="font-bold text-2xl text-foreground tracking-tight">Add Funds</h3>
                <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                  Step {step} of 3 &bull; {step === 1 ? 'Choose Amount' : step === 2 ? 'Select Payment Method' : 'Complete Payment'}
                </p>
              </div>
            </div>
          )}

          {/* Wizard Step Content with AnimatePresence for smooth slide/fade */}
          <div className="flex-1 flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-8 flex-1 flex flex-col justify-between"
                >
                  <div className="space-y-8">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                        Select Amount (USD)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[10, 20, 50, 100].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleAmountSelect(val)}
                            className={`py-4 px-2 rounded-2xl  transition-all duration-300 flex flex-col items-center justify-center gap-1.5 overflow-hidden relative group ${
                              amount === val
                                ? "bg-indigo-600/15 text-indigo-300 shadow-lg shadow-indigo-600/20 scale-105"
                                : "bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className={`text-xl font-bold ${amount === val ? "text-indigo-500" : ""}`}>${val}</span>
                            <span className="text-[11px] font-medium">
                              ~{formatUgx(val).split(" ")[1] || formatUgx(val)}
                            </span>
                            {/* Hover flare */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                        Enter Amount
                      </label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-lg">
                          $
                        </span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => handleCustomAmountChange(e.target.value)}
                          className="py-6 px-9 bg-slate-500/5 shadow-lg hover:shadow-2xl hover:bg-slate-500/10 text-foreground font-semibold text-lg rounded-full transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-400/50 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                    <p className="text-xs text-muted-foreground max-w-[250px] font-medium">
                      Funds will be credited to your legal consultation wallet instantly upon confirmation.
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
                                    
                                     onClick={handleProceedToMethod}
                                   >
                                     Continue
                                   </CustomButton>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
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
                      {/* Mobile Money method card */}
                      <button
                        onClick={() => setPaymentMethod("mobile_money")}
                        className={`w-full p-5 rounded-2xl  text-left transition-all duration-300 flex items-center justify-between gap-4 group overflow-hidden relative ${
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
                        <div
                          className={`h-5 w-5 rounded-full shadow-xl hover:shadow-2xl shadow-orange-600/20 flex items-center justify-center relative z-10 transition-colors `}
                        >
                          {paymentMethod === "mobile_money" && (
                            <motion.div layoutId="methodDot" className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                          )}
                        </div>
                      </button>

                      {/* Credit Card method card */}
                      <button
                        onClick={() => setPaymentMethod("card")}
                        className={`w-full p-5 rounded-2xl text-left transition-all duration-300 flex items-center justify-between gap-4 group overflow-hidden relative ${
                          paymentMethod === "card"
                            ? "bg-indigo-600/10 shadow-xl hover:shadow-2xl shadow-indigo-600/20"
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
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center relative z-10 transition-colors shadow-xl hover:shadow-2xl shadow-indigo-600/20`}
                        >
                          {paymentMethod === "card" && (
                            <motion.div layoutId="methodDot" className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-400/50 flex items-center justify-between gap-4 mt-8">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total: <span className="font-bold text-foreground">{formatUSD(amount)} ({formatUgx(amount)})</span>
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
                      onClick={handleProceedToDetails}
                                   >
                                     Enter Details
                                   </CustomButton>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col justify-between"
                >
                  {paymentMethod === "mobile_money" ? (
                    // Mobile Money detail form
                    <div className="space-y-8 flex-1 flex flex-col justify-between">
                      <div className="space-y-8">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                            Select Network Provider
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            {/* MTN */}
                            <button
                              onClick={() => setNetwork("MTN")}
                              className={`p-5 rounded-2xl text-center transition-all relative overflow-hidden group ${
                                network === "MTN"
                                  ? "bg-yellow-500/10 shadow-lg shadow-yellow-500/20"
                                  : "bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              <span className={`font-extrabold text-base block mb-1 tracking-tight ${network === "MTN" ? "text-yellow-500" : ""}`}>MTN MoMo</span>
                              <span className="text-[11px] font-medium opacity-80">Direct push USSD prompt</span>
                              {network === "MTN" && (
                                <motion.div layoutId="networkDot" className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                              )}
                            </button>

                            {/* Airtel */}
                            <button
                              onClick={() => setNetwork("AIRTEL")}
                              className={`p-5 rounded-2xl text-center transition-all relative overflow-hidden group ${
                                network === "AIRTEL"
                                  ? "bg-red-500/10 shadow-lg shadow-red-500/20"
                                  : "bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              <span className={`font-extrabold text-base block mb-1 tracking-tight ${network === "AIRTEL" ? "text-red-500" : ""}`}>Airtel Money</span>
                              <span className="text-[11px] font-medium opacity-80">Direct push USSD prompt</span>
                              {network === "AIRTEL" && (
                                <motion.div layoutId="networkDot" className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                            Enter Phone Number
                          </label>
                          <div className="relative rounded-full shadow-2xl px-12 py-4 border">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold select-none pr-3">
                              +256
                            </div>
                            <input
                           maxLength={9}
                           minLength={9}
                              placeholder={network === "AIRTEL" ? "701 234567" : "771 234567"}
                              value={phoneNumber}

                              onKeyDown={(e) => {
    // Allow: backspace, delete, tab, arrows, home, end
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (allowedKeys.includes(e.key)) return
    // Block anything that's not a digit
    if (!/^\d$/.test(e.key)) e.preventDefault()
  }}
                              onChange={(e) => {
    // Handles paste and autofill — strips non-numeric characters
    const digits = e.target.value.replace(/\D/g, '')
    setPhoneNumber(digits)
  }}
                              className="ml-8 bg-transparent !border-none focus:border-none !outline-none focus:ring-0 text-foreground font-bold text-lg w-full placeholder:text-muted-foreground"
                            />
                          </div>
                          <p className="text-[11px] font-medium text-muted-foreground mt-3 px-1 flex items-start gap-2">
                            <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
                            A USSD PIN prompt will pop up on this phone to complete the payment.
                          </p>
                        </div>
                      </div>

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
                      onClick={handleInitiateMobileMoney}
                                   >
                                     Topup ${amount} ({formatUgx(amount)})
                                   </CustomButton>
                      </div>
                    </div>
                  ) : (
                   <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-800"
              >
                   {clientSecret && <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
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
                        } as Appearance,
                      }}
                    >
                      <StripePaymentForm
                        amount={amount}
                        transactionReference={txRef}
                        onCancel={() => setStep(1)}
                        onSuccess={(reference) => {
                          router.push(
                            `/dashboard/user/billing/success?ref=${reference}`,
                          );
                        }}
                        // onSuccess={handleStripeSuccess}
                    //         onFailure={handleStripeFailure}
                      />
                    </Elements>}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col justify-center items-center text-center py-6 space-y-8"
                >
                  <div className="relative flex justify-center items-center">
                    <div className="absolute h-32 w-32 rounded-full border-2 border-indigo-500/20 animate-ping duration-1000" />
                    <div className="absolute h-24 w-24 rounded-full border-2 border-orange-500/20 animate-ping duration-1500" />
                    <div className="p-6 rounded-full shadow-lg relative z-10 shadow-2xl backdrop-blur-sm">
                      {paymentMethod === "mobile_money" ? (
                        <PhoneCall className="h-12 w-12 text-orange-400 animate-pulse duration-1000" />
                      ) : (
                        <ShieldCheck className="h-12 w-12 text-indigo-400 animate-pulse" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-2xl text-foreground tracking-tight">
                      {paymentMethod === "mobile_money"
                        ? "Check your phone"
                        : "Verifying Secure Payment"}
                    </h4>
                    <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[300px] mx-auto leading-relaxed">
                      {paymentMethod === "mobile_money"
                        ? "A USSD prompt has been sent. Please enter your MoMo PIN to complete the transaction."
                        : "Securely authenticating your card transaction. Please do not close or reload the page."}
                    </p>
                  </div>

                  {/* Status checklist list */}
                  <div className="w-full max-w-sm bg-slate-500/5 shadow-xl hover:shadow-2xl hover:bg-slate-500/10 rounded-2xl p-5 text-left space-y-4">
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
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Order Summary & Trust Center */}
      <div className="lg:col-span-4 space-y-6 lg:pt-0 pt-2">
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          className="sticky top-8 backdrop-blur-2xl shadow-xl hover:shadow-3xl rounded-3xl p-6 transition-all duration-300 ease-in-out"
        >
          <div className="flex items-center gap-3 border-b border-slate-400/50 pb-5">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Wallet className="h-5 w-5 text-indigo-400" />
            </div>
            <h4 className="font-bold text-xl text-foreground tracking-tight">Summary</h4>
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
                <span className="text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">{formatUgx(amount)}</span>
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

        {/* Trust Center */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className=" backdrop-blur-xl rounded-3xl p-6 shadow-2xl hover:shadow-3xl space-y-5"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-full bg-emerald-500/10 shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight">Bank-Level Security</p>
              <p className="text-xs font-medium text-muted-foreground mt-1 leading-relaxed">
                256-bit SSL encryption ensures your financial data is fully protected and never stored on our servers.
              </p>
            </div>
          </div>
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
          
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-full bg-indigo-500/10 shrink-0 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight">Instant Processing</p>
              <p className="text-xs font-medium text-muted-foreground mt-1 leading-relaxed">
                Funds are credited to your legal consultation wallet instantly upon successful verification.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
