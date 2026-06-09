// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Deposits Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  DepositRequest,
  DepositInitiationResponse,
  DepositStatusResponse,
} from "../types";
import {
  validatePaymentId,
  validateAmount,
  validatePhoneNumber,
  validateCustomerMessage,
  validateMetadata,
  generateUUID,
} from "../utils";

export class DepositsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate a new deposit (collect from customer).
   *
   * - Idempotent: safe to retry with the same `depositId`.
   * - Always check `response.status` — ACCEPTED does not mean completed.
   * - Store `depositId` in your database **before** calling this method.
   *
   * @example
   * ```ts
   * const { v4: uuidv4 } = require('uuid');
   * const depositId = uuidv4();
   * // persist depositId to DB here
   * const result = await pawapay.deposits.initiate({
   *   depositId,
   *   payer: { type: 'MMO', accountDetails: { phoneNumber: '256700123456', provider: 'MTN_MOMO_UGA' } },
   *   amount: '5000',
   *   currency: 'UGX',
   * });
   * ```
   */
  async initiate(
    request: DepositRequest
  ): Promise<DepositInitiationResponse> {
    this.validate(request);
    return this.http.request<DepositInitiationResponse>("/v2/deposits", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Check the current status of a deposit.
   *
   * Use this to poll when you don't have callbacks configured, or to
   * reconcile ACCEPTED deposits that never received a callback.
   */
  async checkStatus(depositId: string): Promise<DepositStatusResponse> {
    validatePaymentId(depositId, "depositId");
    return this.http.request<DepositStatusResponse>(
      `/v2/deposits/${depositId}`
    );
  }

  /**
   * Trigger a resend of the callback for a deposit in its final state.
   * Useful for reconciliation when your callback endpoint was unavailable.
   */
  async resendCallback(depositId: string): Promise<void> {
    validatePaymentId(depositId, "depositId");
    await this.http.request<void>(
      `/v2/deposits/${depositId}/resend-callback`,
      { method: "POST" }
    );
  }

  /**
   * Convenience helper: generates a new UUIDv4 `depositId` for you.
   * Store this in your DB *before* calling `initiate()`.
   */
  generateId(): string {
    return generateUUID();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(req: DepositRequest): void {
    validatePaymentId(req.depositId, "depositId");
    validateAmount(req.amount);
    validatePhoneNumber(req.payer.accountDetails.phoneNumber);
    if (req.customerMessage) validateCustomerMessage(req.customerMessage);
    if (req.metadata) validateMetadata(req.metadata);
    if (!req.currency || req.currency.length !== 3) {
      throw new Error(
        `currency must be a 3-character ISO 4217 code (got "${req.currency}").`
      );
    }
  }
}
