// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — React Hook
//  useTransactionStatus
//
//  Client-side polling hook.
//  Polls YOUR OWN Next.js API route — never Ssentezo directly.
//  The API route must be set up as shown in examples/route-handlers.ts.
//
//  Usage:
//    "use client";
//    import { useTransactionStatus } from "@/lib/ssentezo/hooks/useTransactionStatus";
// ─────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionStatus } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PollingState = "idle" | "polling" | "succeeded" | "failed" | "indeterminate" | "timeout" | "error";

export interface UseTransactionStatusOptions {
  /**
   * Your internal API endpoint that wraps the Ssentezo status check.
   * The `{reference}` placeholder is replaced with the actual reference.
   *
   * @default "/api/payments/status/{reference}"
   */
  endpoint?: string;

  /**
   * How often to poll, in milliseconds.
   * @default 5000
   */
  intervalMs?: number;

  /**
   * Maximum total polling time before giving up, in milliseconds.
   * @default 120000  (2 minutes)
   */
  maxWaitMs?: number;

  /**
   * Called when a terminal status is received.
   */
  onTerminal?: (status: TransactionStatus) => void;
}

export interface UseTransactionStatusReturn {
  /** Current polling lifecycle state. */
  pollingState: PollingState;
  /** The last known transaction status from the API, or null if not yet fetched. */
  transactionStatus: TransactionStatus | null;
  /** Any error message from the last failed poll. */
  error: string | null;
  /** How many polls have been made. */
  pollCount: number;
  /** Manually kick off polling for a reference. */
  startPolling: (reference: string) => void;
  /** Cancel polling. */
  stopPolling: () => void;
  /** Reset all state back to idle. */
  reset: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TERMINAL: Set<TransactionStatus> = new Set([
  "SUCCEEDED",
  "FAILED",
  "INDETERMINATE",
]);

const DEFAULT_ENDPOINT  = "/api/payments/status/{reference}";
const DEFAULT_INTERVAL  = 5_000;
const DEFAULT_MAX_WAIT  = 120_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Poll your API route for a Ssentezo transaction status.
 *
 * Stops automatically when a terminal status is reached
 * (`SUCCEEDED`, `FAILED`, `INDETERMINATE`) or when `maxWaitMs` elapses.
 *
 * @example
 * "use client";
 * import { useTransactionStatus } from "@/lib/ssentezo/hooks/useTransactionStatus";
 *
 * export function PaymentStatus({ reference }: { reference: string }) {
 *   const { pollingState, transactionStatus, startPolling } = useTransactionStatus({
 *     onTerminal: (status) => {
 *       if (status === "SUCCEEDED") router.push("/checkout/success");
 *     },
 *   });
 *
 *   useEffect(() => {
 *     if (reference) startPolling(reference);
 *   }, [reference]);
 *
 *   if (pollingState === "polling") return <Spinner />;
 *   return <p>{transactionStatus}</p>;
 * }
 */
export function useTransactionStatus(
  opts: UseTransactionStatusOptions = {}
): UseTransactionStatusReturn {
  const {
    endpoint   = DEFAULT_ENDPOINT,
    intervalMs = DEFAULT_INTERVAL,
    maxWaitMs  = DEFAULT_MAX_WAIT,
    onTerminal,
  } = opts;

  // ── State ──────────────────────────────────────────────────────────────────
  const [pollingState,       setPollingState]       = useState<PollingState>("idle");
  const [transactionStatus,  setTransactionStatus]  = useState<TransactionStatus | null>(null);
  const [error,              setError]              = useState<string | null>(null);
  const [pollCount,          setPollCount]          = useState(0);

  // ── Refs (survive re-renders, safe to read inside setInterval) ─────────────
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef  = useRef<number>(0);
  const referenceRef = useRef<string>("");
  const onTerminalRef = useRef(onTerminal);

  // Keep callback ref fresh without restarting effect
  useEffect(() => { onTerminalRef.current = onTerminal; }, [onTerminal]);

  // ── Core poll function ─────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const ref = referenceRef.current;
    if (!ref) return;

    // Check deadline
    if (Date.now() > deadlineRef.current) {
      clearInterval(timerRef.current!);
      timerRef.current = null;
      setPollingState("timeout");
      return;
    }

    try {
      const url = endpoint.replace("{reference}", encodeURIComponent(ref));
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        // Keep polling on transient server errors; stop on 4xx
        if (res.status >= 400 && res.status < 500) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPollingState("error");
        }
        return;
      }

      const data = await res.json() as { status: TransactionStatus };
      const status = data.status;

      setTransactionStatus(status);
      setPollCount((c) => c + 1);
      setError(null);

      if (TERMINAL.has(status)) {
        clearInterval(timerRef.current!);
        timerRef.current = null;

        const next: PollingState =
          status === "SUCCEEDED"     ? "succeeded"    :
          status === "FAILED"        ? "failed"       :
                                       "indeterminate";
        setPollingState(next);
        onTerminalRef.current?.(status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Don't stop — transient network error, try again next tick
    }
  }, [endpoint]);

  // ── startPolling ───────────────────────────────────────────────────────────
  const startPolling = useCallback(
    (reference: string) => {
      // Clear any existing timer
      if (timerRef.current) clearInterval(timerRef.current);

      referenceRef.current = reference;
      deadlineRef.current  = Date.now() + maxWaitMs;

      setPollingState("polling");
      setTransactionStatus(null);
      setError(null);
      setPollCount(0);

      // Poll immediately, then on interval
      void poll();
      timerRef.current = setInterval(poll, intervalMs);
    },
    [poll, intervalMs, maxWaitMs]
  );

  // ── stopPolling ────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPollingState("idle");
  }, []);

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    referenceRef.current = "";
    setPollingState("idle");
    setTransactionStatus(null);
    setError(null);
    setPollCount(0);
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    pollingState,
    transactionStatus,
    error,
    pollCount,
    startPolling,
    stopPolling,
    reset,
  };
}
