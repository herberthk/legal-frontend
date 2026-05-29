// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/checkout/CheckoutForm.tsx
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useTransactionStatus,
  type PollingState,
} from "@/lib/ssentezo/hooks";
import { initiatePayment, verifyPhoneNumber } from "@/lib/actions";

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
  const [msisdn,      setMsisdn]      = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();
  const [amount,setAmount] = useState(1000);
  const orderId="";
  const reason="Consultation Fee";

  const { pollingState, transactionStatus, startPolling, error: pollError } =
    useTransactionStatus({
      endpoint:  "/api/payments/status/{reference}",
      intervalMs: 5_000,
      maxWaitMs:  120_000,
      onTerminal: (status) => {
        if (status === "SUCCEEDED") {
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
    startTransition(async () => {
      const result = await verifyPhoneNumber(msisdn);
      // Stub for example:
      // const result = { success: true, fullName: "John Doe" };
      if (!result.success) {
        setErrorMsg(result.error ?? "Verification failed.");
        return;
      }
      setVerifiedName(result.data.fullName ?? null);
      setStep("verify");
    });
  }

  const handlePay = async() => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await initiatePayment({ msisdn, amount });
     console.log('initiatePayment',result);
      if (!result.success) {
        setErrorMsg(result.error ?? "Payment failed.");
        return;
      }
      setStep("awaiting");
      startPolling(result.data.reference);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">Pay UGX {amount.toLocaleString("en-UG")}</h2>
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
            placeholder="256709920188"
            value={msisdn}
            onChange={(e) => setMsisdn(e.target.value)}
            className="w-full p-2 mb-3 text-lg"
          />
          <button
            onClick={handleVerify}
            disabled={isPending || msisdn.length < 12}
            className="w-full p-3 text-lg cursor-pointer"
          >
            {isPending ? "Verifying…" : "Verify Number →"}
          </button>
        </div>
      )}

      {/* Step 2 — Confirm recipient name */}
      {step === "verify" && (
        <div className="p-4 flex flex-col items-center justify-center gap-4">
          <p>Paying to:</p>
          <p className="text-2xl font-bold">{verifiedName}</p>
          <p className="text-gray-600">{msisdn}</p>
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full p-3 text-lg border-none rounded cursor-pointer bg-blue-500 text-white"
           
          >
            {isPending ? "Initiating…" : `Pay UGX ${amount.toLocaleString("en-UG")}`}
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
            A prompt has been sent to <strong>{msisdn}</strong>.
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

