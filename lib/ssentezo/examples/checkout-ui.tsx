// ─────────────────────────────────────────────────────────────────────────────
//  Ssentezo Wallet SDK — Complete Checkout UI Example
//
//  Demonstrates:
//  • Server Action to initiate payment
//  • Client Component with useTransactionStatus hook for live status updates
//  • MSISDN verification before payment
//
//  File locations:
//    app/checkout/page.tsx         ← Server Component (data fetching)
//    app/checkout/CheckoutForm.tsx ← Client Component (form + status UI)
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/checkout/actions.ts
// ══════════════════════════════════════════════════════════════════════════════

"use server";

import {
  getSsentezoWallet,
  generatePrefixedReference,
  isSsentezoValidationError,
  SsentezoError,
} from "..";

const wallet = getSsentezoWallet();

export interface InitiatePaymentResult {
  success:   boolean;
  reference?: string;
  error?:    string;
  fieldErrors?: Record<string, string[]>;
}

export interface VerifyNumberResult {
  success:  boolean;
  fullName?: string;
  error?:   string;
}

/**
 * Verify a phone number before showing the payment confirmation.
 */
export async function verifyNumber(msisdn: string): Promise<VerifyNumberResult> {
  try {
    const info = await wallet.msisdn.verify(msisdn);
    return { success: true, fullName: `${info.FirstName} ${info.Surname}`.trim() };
  } catch (err) {
    if (isSsentezoValidationError(err)) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Could not verify number. Please try again." };
  }
}

/**
 * Initiate a mobile money payment collection.
 */
export async function initiatePayment(params: {
  msisdn:  string;
  amount:  number;
  reason:  string;
  orderId: string;
}): Promise<InitiatePaymentResult> {
  const externalReference = generatePrefixedReference(`order_${params.orderId}`);

  try {
    await wallet.transactions.deposit({
      externalReference,
      msisdn:          params.msisdn,
      amount:          params.amount,
      reason:          params.reason,
      successCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
      failureCallback:  `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`,
    });

    return { success: true, reference: externalReference };
  } catch (err) {
    if (isSsentezoValidationError(err)) {
      return { success: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    if (err instanceof SsentezoError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Payment initiation failed. Please try again." };
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// FILE: app/checkout/CheckoutForm.tsx
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  useTransactionStatus,
  type PollingState,
} from "../hooks";
// import { initiatePayment, verifyNumber } from "./actions";

// ── Step type ──────────────────────────────────────────────────────────────────
type Step = "form" | "verify" | "awaiting" | "complete" | "failed";

// ── Component ──────────────────────────────────────────────────────────────────
export function CheckoutForm({
  orderId,
  amount,
  reason,
}: {
  orderId: string;
  amount:  number;
  reason:  string;
}) {
  const router = useRouter();

  const [step,        setStep]        = useState<Step>("form");
  const [msisdn,      setMsisdn]      = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const { pollingState, transactionStatus, startPolling, error: pollError } =
    useTransactionStatus({
      endpoint:  "/api/payments/status/{reference}",
      intervalMs: 5_000,
      maxWaitMs:  120_000,
      onTerminal: (status) => {
        if (status === "SUCCEEDED") {
          setStep("complete");
          // Give the user a moment to see the success state, then redirect
          setTimeout(() => router.push(`/orders/${orderId}/confirmation`), 2000);
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

  function handleVerify() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await verifyNumber(msisdn);
      // Stub for example:
      // const result = { success: true, fullName: "John Doe" };
      if (!result.success) {
        setErrorMsg(result.error ?? "Verification failed.");
        return;
      }
      setVerifiedName(result.fullName ?? null);
      setStep("verify");
    });
  }

  function handlePay() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await initiatePayment({ msisdn, amount, reason, orderId });
      // Stub for example:
      // const result = { success: true, reference: "order_abc_ref" };
      if (!result.success) {
        setErrorMsg(result.error ?? "Payment failed.");
        return;
      }
      setStep("awaiting");
      startPolling(result.reference!);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2>Pay UGX {amount.toLocaleString("en-UG")}</h2>
      <p style={{ color: "#666" }}>{reason}</p>

      {errorMsg && (
        <div style={{ color: "red", marginBottom: 12 }}>{errorMsg}</div>
      )}

      {/* Step 1 — Enter phone number */}
      {step === "form" && (
        <div>
          <label htmlFor="msisdn" style={{ display: "block", marginBottom: 4 }}>
            Mobile Money Number
          </label>
          <input
            id="msisdn"
            type="tel"
            placeholder="256709920188"
            value={msisdn}
            onChange={(e) => setMsisdn(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 12, fontSize: 16 }}
          />
          <button
            onClick={handleVerify}
            disabled={isPending || msisdn.length < 12}
            style={{ width: "100%", padding: 12, fontSize: 16, cursor: "pointer" }}
          >
            {isPending ? "Verifying…" : "Verify Number →"}
          </button>
        </div>
      )}

      {/* Step 2 — Confirm recipient name */}
      {step === "verify" && (
        <div>
          <p>Paying to:</p>
          <p style={{ fontSize: 20, fontWeight: "bold" }}>{verifiedName}</p>
          <p style={{ color: "#666" }}>{msisdn}</p>
          <button
            onClick={handlePay}
            disabled={isPending}
            style={{
              width:      "100%",
              padding:    12,
              fontSize:   16,
              background: "#0070f3",
              color:      "#fff",
              border:     "none",
              cursor:     "pointer",
            }}
          >
            {isPending ? "Initiating…" : `Pay UGX ${amount.toLocaleString("en-UG")}`}
          </button>
          <button
            onClick={() => setStep("form")}
            style={{ width: "100%", padding: 8, marginTop: 8, cursor: "pointer" }}
          >
            ← Change number
          </button>
        </div>
      )}

      {/* Step 3 — Awaiting PIN entry */}
      {step === "awaiting" && (
        <div style={{ textAlign: "center" }}>
          <PollingStatusBadge state={pollingState} status={transactionStatus} />
          <p style={{ marginTop: 16 }}>
            A prompt has been sent to <strong>{msisdn}</strong>.
            <br />
            Enter your Mobile Money PIN to complete payment.
          </p>
          <p style={{ color: "#999", fontSize: 12 }}>
            Checking status every 5 seconds…
          </p>
        </div>
      )}

      {/* Step 4 — Success */}
      {step === "complete" && (
        <div style={{ textAlign: "center", color: "#0a7a0a" }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <h3>Payment Successful!</h3>
          <p>Redirecting to your order…</p>
        </div>
      )}

      {/* Step 5 — Failed */}
      {step === "failed" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>❌</div>
          <h3>Payment Failed</h3>
          <p>Transaction status: {transactionStatus}</p>
          <button
            onClick={() => setStep("form")}
            style={{ padding: "8px 24px", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Status badge sub-component ─────────────────────────────────────────────────

function PollingStatusBadge({
  state,
  status,
}: {
  state:  PollingState;
  status: string | null;
}) {
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
