// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/checkout/CheckoutForm.tsx
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  useTransactionStatus,
  type PollingState,
} from "@/sdk/hooks";
import { verifyPhoneNumber } from "@/lib/actions";
import { isValidAmount, parseUgandanNumber } from "@/utils";

// ── Status badge sub-component ─────────────────────────────────────────────────

const PollingStatusBadge = ({
  state,
  status,
}: {
  state:  PollingState;
  status: string | null;
}) => {
  const label: Record<PollingState, string> = {
    idle:          "Idle",
    polling:       "Waiting for confirmation…",
    succeeded:     "Payment confirmed ✅",
    failed:        "Payment failed ❌",
    indeterminate: "Status unclear — checking…",
    timeout:       "Timed out. Check your order page.",
    error:         "Could not reach payment server.",
  };

  const color: Record<PollingState, string> = {
    idle:          "#999",
    polling:       "#0070f3",
    succeeded:     "#0a7a0a",
    failed:        "#c00",
    indeterminate: "#d97706",
    timeout:       "#c00",
    error:         "#c00",
  };

  return (
    <div style={{ color: color[state], fontSize: 18, fontWeight: "bold" }}>
      {label[state]}
      {status && state === "polling" && (
        <span style={{ fontSize: 13, fontWeight: "normal", color: "#666" }}>
          {" "}({status})
        </span>
      )}
    </div>
  );
}

// ── Step type ──────────────────────────────────────────────────────────────────
type Step = "form" | "verify" | "awaiting" | "complete" | "failed";

// ── Component ──────────────────────────────────────────────────────────────────
const Page = () => {

  const [step,        setStep]        = useState<Step>("form");
  // const [msisdn,      setMsisdn]      = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();
  const reason="Wallet Top Up";
  const numberPrefix =  "256";
  const feePercentage = 0.025 // 2.5%
 const [value,handleValueChange] = useState<{msisdn:string,amount:string}>({msisdn:"",amount:''});
 const [fee,setFee] = useState(0);
 
 useEffect(() => {
  if(value.amount.length) {
    const fee = Number(value.amount) * feePercentage;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFee(fee);
  }
 }, [value.amount]);

  const { pollingState, transactionStatus, startPolling, error: pollError } =
    useTransactionStatus({
      endpoint:  "/api/payments/status/{reference}",
      intervalMs: 7_000, // 7 seconds interval
      //maxWaitMs:  14_400,
      onTerminal: (status) => {
        if (status === "COMPLETED") {
          setStep("complete");
          // Give the user a moment to see the success state, then redirect
        //   setTimeout(() => router.push(`/orders/${orderId}/confirmation`), 2000);
        console.log("Payment Successful")
        } else {
          setStep("failed");
        }
      },
    });

  // Sync polling errors into UI
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pollError) setErrorMsg(pollError);
  }, [pollError]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleVerify = async() => {
    setErrorMsg(null);
    const amountResult = isValidAmount(value.amount);
    console.log('amountResult',amountResult);
    if(!amountResult.isValid && amountResult.error) {
      setErrorMsg(amountResult.error);
      return;
    }
    const {isValid,formattedNumber,error,provider} = parseUgandanNumber(value.msisdn);
      console.log({isValid,formattedNumber,error,provider});
      if(!isValid && error) {
        setErrorMsg(error);
        return;
      }

      if(!formattedNumber) {
        setErrorMsg("Formatted number is required.");
        return;
      }
    startTransition(async () => {
    //     const result = await verifyPhoneNumber(formattedNumber);
    // console.log('result',result);
    //   if (!result.success) {
    //     setErrorMsg(result.error ?? "Verification failed.");
    //     return;
    //   }
    //   setVerifiedName(result.data.fullName ?? null);
    //   setStep("verify");
    });
  }

  const handlePay = async() => {
    setErrorMsg(null);

    const amountResult = isValidAmount(value.amount);
    console.log('amountResult',amountResult);
    if(!amountResult.isValid && amountResult.error) {
      setErrorMsg(amountResult.error);
      return;
    }
    const {isValid,formattedNumber,error,provider} = parseUgandanNumber(value.msisdn);
      console.log({isValid,formattedNumber,error,provider});
      if(!isValid && error) {
        setErrorMsg(error);
        return;
      }

      if(!formattedNumber) {
        setErrorMsg("Formatted number is required.");
        return;
      }
    startTransition(async () => {
    
    //   const result = await initiatePayment({ msisdn:formattedNumber, amount:Number(value.amount) });
    //  console.log('initiatePayment',result);
    //   if (!result.success) {
    //     setErrorMsg(result.error ?? "Payment failed.");
    //     return;
    //   }
    //   setStep("awaiting");
    //   startPolling(result.data.reference);
    });
  }

   const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (allowedKeys.includes(e.key)) return;
      if (!/^\d$/.test(e.key)) e.preventDefault();
    }, []);
  
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
       handleValueChange((prev) => ({ ...prev, [e.target.name]: digits }));
    };

  return (
    <div className="p-4 flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">Pay UGX {Number(value.amount).toLocaleString("en-UG")}</h2>
      <p className="text-gray-600">{reason}</p>

      {errorMsg && (
        <div className="text-red-500 text-center">{errorMsg}</div>
      )}

      {/* Step 1 — Enter phone number */}
      {step === "form" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <label htmlFor="msisdn" className="text-gray-600">Mobile Money Number</label>
          <input
            id="msisdn"
            type="tel"
            name="msisdn"
            placeholder="0709920188"
            value={value.msisdn}
            maxLength={9}
            minLength={9}
            className="w-full p-2 mb-3 text-lg"
             onKeyDown={handleKeyDown}
              onChange={handleChange}
              inputMode="numeric"
          />
           <input
            id="amount"
            type="text"
            name="amount"
            placeholder="Enter Amount"
            value={value.amount}
            className="w-full p-2 mb-3 text-lg"
             onKeyDown={handleKeyDown}
              onChange={handleChange}
              inputMode="numeric"
          />
          <button
            onClick={handleVerify}
            disabled={isPending || value.msisdn.length !== 9 || Number(value.amount) < 1000}
            className="w-full p-3 text-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Verifying…" : "Verify Number"}
          </button>
        </div>
      )}

      {/* Step 2 — Confirm recipient name */}
      {step === "verify" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <p>Paying to:</p>
          <p className="text-2xl font-bold">{verifiedName}</p>
          <p className="text-gray-600">{numberPrefix + value.msisdn}</p>
           
            <p>Transaction Charge: {fee.toLocaleString("en-UG")}</p>
            <p>Amount to be deducted: {(Number(value.amount) + fee).toLocaleString("en-UG")}</p>
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full p-3 text-lg border-none rounded cursor-pointer bg-blue-500 text-white"
           
          >
            {isPending ? "Initiating…" : `Pay UGX ${(Number(value.amount) + fee).toLocaleString("en-UG")}`}
          </button>
          <button
            onClick={() => setStep("form")}
            className="w-full p-3 text-lg border-none rounded cursor-pointer bg-blue-500 text-white"
            // style={{ width: "100%", padding: 8, marginTop: 8, cursor: "pointer" }}
          >
            ← Change number
          </button>
        </div>
      )}

      {/* Step 3 — Awaiting PIN entry */}
      {step === "awaiting" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <PollingStatusBadge state={pollingState} status={transactionStatus} />
          <p className="mt-4">
            A prompt has been sent to <strong>{value.msisdn}</strong>.
            <br />
            Enter your Mobile Money PIN to complete payment.
          </p>
          <p className="text-gray-600 text-sm">
            Checking status every 5 seconds…
          </p>
        </div>
      )}

      {/* Step 4 — Success */}
      {step === "complete" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">✅</div>
          <h3 className="text-xl font-bold">Payment Successful!</h3>
          <p className="text-gray-600">Redirecting to your order…</p>
        </div>
      )}

      {/* Step 5 — Failed */}
      {step === "failed" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">❌</div>
          <h3 className="text-xl font-bold">Payment Failed</h3>
          <p className="text-gray-600">Transaction status: {transactionStatus}</p>
          <button
            onClick={() => setStep("form")}
            className="w-full p-3 text-lg border-none rounded cursor-pointer bg-blue-500 text-white"
            // style={{ padding: "8px 24px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default Page;

