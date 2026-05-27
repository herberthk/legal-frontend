// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Transactions Resource
// ─────────────────────────────────────────────

import type { SsentezoClient } from "../client";
import type {
  TransactionInitResult,
  TransactionParams,
  TransactionStatus,
  TransactionStatusResult,
} from "../types";
import {
  validateAmount,
  validateCallbackUrl,
  validateExternalReference,
  validateMsisdn,
} from "../validators";
import { sleep } from "../utils";

// ── Polling defaults ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;  // 5 s between polls
const POLL_MAX_WAIT_MS = 120_000; // give up after 2 minutes

const TERMINAL_STATUSES = new Set<TransactionStatus>([
  "SUCCEEDED",
  "FAILED",
  "INDETERMINATE",
]);

// ── Resource ──────────────────────────────────────────────────────────────────

/**
 * Mobile money deposit and withdraw operations.
 *
 * Available via `wallet.transactions`.
 */
export class TransactionsResource {
  constructor(private readonly client: SsentezoClient) {}

  // ── Deposit ─────────────────────────────────────────────────────────────────

  /**
   * Collect money from a mobile money account into your wallet.
   *
   * Sends a USSD prompt to the payer's phone. The payer must enter their
   * Mobile Money PIN to confirm. The response will be `PENDING` — use
   * `successCallback` / `failureCallback` or call `getStatus()` to track
   * the outcome.
   *
   * @example
   * const result = await wallet.transactions.deposit({
   *   externalReference: generateReference(),
   *   msisdn:            "256709920188",
   *   amount:            5000,
   *   reason:            "Order #1234 payment",
   *   successCallback:   "https://yourapp.com/api/ssentezo/callback",
   *   failureCallback:   "https://yourapp.com/api/ssentezo/callback",
   * });
   * // result.transactionStatus === "PENDING"
   *
   * @throws {SsentezoValidationError} on bad input (client-side, before the request is sent).
   * @throws {SsentezoError}           on API-level errors.
   */
  async deposit(params: TransactionParams): Promise<TransactionInitResult> {
    this.validateTransactionParams(params);
    return this.client.post<TransactionInitResult>("/deposit", buildBody(params));
  }

  // ── Withdraw ────────────────────────────────────────────────────────────────

  /**
   * Send money from your wallet to a mobile money account.
   *
   * Verify the recipient's phone number with `wallet.msisdn.verify()` first
   * to avoid sending to the wrong person.
   *
   * @example
   * const result = await wallet.transactions.withdraw({
   *   externalReference: generateReference(),
   *   msisdn:            "256709920188",
   *   amount:            10000,
   *   reason:            "Supplier payout",
   *   name:              "John Doe",
   * });
   *
   * @throws {SsentezoValidationError} on bad input.
   * @throws {SsentezoError}           on API-level errors (e.g. UPPER_CEILING_BREACH).
   */
  async withdraw(params: TransactionParams): Promise<TransactionInitResult> {
    this.validateTransactionParams(params);
    return this.client.post<TransactionInitResult>("/withdraw", buildBody(params));
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  /**
   * Check the current status of a mobile money transaction.
   *
   * **Prefer callback URLs over polling.** If you must poll, use a
   * reasonable interval (≥ 5 s) with exponential back-off. Never poll
   * in a tight loop.
   *
   * @param externalReference  The reference you supplied when creating the transaction.
   *
   * @example
   * const status = await wallet.transactions.getStatus("order_abc-123");
   * if (status.transactionStatus === "SUCCEEDED") { ... }
   */
  async getStatus(externalReference: string): Promise<TransactionStatusResult> {
    validateExternalReference(externalReference);
    return this.client.post<TransactionStatusResult>(
      `/get_status/${encodeURIComponent(externalReference)}`
    );
  }

  // ── Polling helper ──────────────────────────────────────────────────────────

  /**
   * Poll the status endpoint until the transaction reaches a terminal state
   * (`SUCCEEDED`, `FAILED`, or `INDETERMINATE`), or until `maxWaitMs` elapses.
   *
   * Only use this when you cannot receive callbacks (e.g. in a CLI or test
   * environment). In production, prefer webhook callbacks.
   *
   * @param externalReference  The reference you supplied when creating the transaction.
   * @param opts.intervalMs    How long to wait between polls (default: 5000 ms).
   * @param opts.maxWaitMs     Maximum total time to wait (default: 120000 ms / 2 min).
   * @param opts.onPoll        Optional callback invoked after each poll with the current status.
   *
   * @returns The final `TransactionStatusResult` once a terminal status is reached,
   *          or `null` if `maxWaitMs` was exceeded before a terminal status arrived.
   *
   * @example
   * const result = await wallet.transactions.pollUntilComplete("order_abc-123", {
   *   onPoll: (s) => console.log("Still waiting:", s.transactionStatus),
   * });
   * if (result?.transactionStatus === "SUCCEEDED") { ... }
   */
  async pollUntilComplete(
    externalReference: string,
    opts: {
      intervalMs?: number;
      maxWaitMs?: number;
      onPoll?: (status: TransactionStatusResult) => void;
    } = {}
  ): Promise<TransactionStatusResult | null> {
    const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
    const maxWaitMs  = opts.maxWaitMs  ?? POLL_MAX_WAIT_MS;
    const deadline   = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const status = await this.getStatus(externalReference);

      opts.onPoll?.(status);

      if (TERMINAL_STATUSES.has(status.transactionStatus)) {
        return status;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      await sleep(Math.min(intervalMs, remaining));
    }

    return null; // timed out
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private validateTransactionParams(params: TransactionParams): void {
    validateExternalReference(params.externalReference);
    validateMsisdn(params.msisdn);
    validateAmount(params.amount);
    validateCallbackUrl(params.successCallback, "successCallback");
    validateCallbackUrl(params.failureCallback, "failureCallback");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBody(params: TransactionParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    externalReference: params.externalReference,
    msisdn:            params.msisdn,
    amount:            params.amount,
    currency:          params.currency ?? "UGX",
    reason:            params.reason,
  };

  if (params.name              !== undefined) body.name              = params.name;
  if (params.successCallback   !== undefined) body.success_callback  = params.successCallback;
  if (params.failureCallback   !== undefined) body.failure_callback  = params.failureCallback;

  return body;
}
