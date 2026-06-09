// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Polling Helper
//
// pawaPay is an async API: ACCEPTED on initiation does NOT mean completed.
// This helper polls a status-check function until the transaction reaches
// a final state (COMPLETED / FAILED) or the timeout/max-attempts is reached.
// ─────────────────────────────────────────────────────────────────────────────

import { sleep } from "../utils";
import { PawaPayError } from "../errors";

export type FinalStatus = "COMPLETED" | "FAILED";

export interface PollOptions {
  /**
   * Maximum number of polling attempts (default: 20).
   * Each attempt waits `intervalMs` before the next call.
   */
  maxAttempts?: number;
  /**
   * Milliseconds between polls (default: 3 000).
   * Increase for long-running providers.
   */
  intervalMs?: number;
  /**
   * Optional AbortSignal to cancel polling early.
   */
  signal?: AbortSignal;
  /**
   * Called on each attempt so callers can log / update UI.
   */
  onAttempt?: (attempt: number, response: unknown) => void;
}

export interface PollResult<T> {
  /** The last status response from the API */
  response: T;
  /** How many attempts were made */
  attempts: number;
  /** Whether polling ended because a final state was reached */
  resolved: boolean;
}

/**
 * Polls `checkFn` until the returned object's `status` or `finalStatus`
 * field equals a terminal value, or until options are exhausted.
 *
 * Works for deposits, payouts, refunds, and remittances.
 *
 * @example
 * ```ts
 * const { response } = await pollUntilFinal(
 *   () => pawapay.deposits.checkStatus(depositId),
 *   { maxAttempts: 30, intervalMs: 5000 }
 * );
 * if (response.finalStatus === 'COMPLETED') { // success }
 * ```
 */
export async function pollUntilFinal<
  T extends { status?: string; finalStatus?: string }
>(
  checkFn: () => Promise<T>,
  options: PollOptions = {}
): Promise<PollResult<T>> {
  const {
    maxAttempts = 20,
    intervalMs = 3_000,
    signal,
    onAttempt,
  } = options;

  const FINAL_STATUSES = new Set<string>(["COMPLETED", "FAILED"]);

  let lastResponse!: T;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new PawaPayError("Polling cancelled by AbortSignal.");
    }

    lastResponse = await checkFn();
    onAttempt?.(attempt, lastResponse);

    const currentStatus = lastResponse.finalStatus ?? lastResponse.status;
    if (currentStatus && FINAL_STATUSES.has(currentStatus)) {
      return { response: lastResponse, attempts: attempt, resolved: true };
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  return { response: lastResponse, attempts: maxAttempts, resolved: false };
}

/**
 * Same as `pollUntilFinal` but throws a `PawaPayError` if polling times out
 * without reaching a final state. Useful when you want a clean "await and
 * get the result" pattern without checking `resolved`.
 */
export async function pollUntilFinalOrThrow<
  T extends { status?: string; finalStatus?: string }
>(
  checkFn: () => Promise<T>,
  options: PollOptions = {}
): Promise<T> {
  const result = await pollUntilFinal(checkFn, options);
  if (!result.resolved) {
    throw new PawaPayError(
      `Transaction did not reach a final state after ${result.attempts} polling attempt(s). ` +
        `Last status: ${result.response.finalStatus ?? result.response.status ?? "unknown"}`
    );
  }
  return result.response;
}
