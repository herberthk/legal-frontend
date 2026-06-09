// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Payouts Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  PayoutRequest,
  PayoutInitiationResponse,
  PayoutStatusResponse,
  BulkPayoutRequest,
  BulkPayoutResponse,
} from "../types";
import {
  validatePaymentId,
  validateAmount,
  validatePhoneNumber,
  validateCustomerMessage,
  validateMetadata,
  generateUUID,
  resolveAccountDetails,
} from "../utils";
import { PawaPayValidationError } from "../errors";

export class PayoutsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate a single payout (send money to a customer).
   *
   * - Idempotent: safe to retry with the same `payoutId`.
   * - Requires sufficient balance in your pawaPay wallet.
   * - Store `payoutId` in your database **before** calling this method.
   *
   * @example
   * ```ts
   * const payoutId = pawapay.payouts.generateId();
   * // persist payoutId to DB here
   * const result = await pawapay.payouts.initiate({
   *   payoutId,
   *   recipient: { type: 'MMO', accountDetails: { phoneNumber: '256700123456', provider: 'MTN_MOMO_UGA' } },
   *   amount: '10000',
   *   currency: 'UGX',
   * });
   * ```
   */
  async initiate(request: PayoutRequest): Promise<PayoutInitiationResponse> {
    const validatedRequest = this.validateSingle(request);
    return this.http.request<PayoutInitiationResponse>("/v2/payouts", {
      method: "POST",
      body: validatedRequest,
    });
  }

  /**
   * Initiate multiple payouts in a single API call (up to 100).
   * Each payout in the response must be checked individually for status.
   */
  async initiateBulk(request: BulkPayoutRequest): Promise<BulkPayoutResponse> {
    if (!request.payouts || request.payouts.length === 0) {
      throw new PawaPayValidationError(
        "Bulk payout request must contain at least one payout.",
        "payouts"
      );
    }
    if (request.payouts.length > 100) {
      throw new PawaPayValidationError(
        `Bulk payout supports a maximum of 100 payouts per request (got ${request.payouts.length}).`,
        "payouts"
      );
    }
    request.payouts = request.payouts.map((p, i) => this.validateSingle(p, i));
    return this.http.request<BulkPayoutResponse>("/v2/payouts/bulk", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Check the current status of a payout.
   */
  async checkStatus(payoutId: string): Promise<PayoutStatusResponse> {
    validatePaymentId(payoutId, "payoutId");
    return this.http.request<PayoutStatusResponse>(`/v2/payouts/${payoutId}`);
  }

  /**
   * Cancel a payout that is in ENQUEUED state (provider temporarily unavailable).
   * Only payouts in ENQUEUED status can be cancelled.
   */
  async cancelEnqueued(payoutId: string): Promise<void> {
    validatePaymentId(payoutId, "payoutId");
    await this.http.request<void>(`/v2/payouts/${payoutId}/cancel`, {
      method: "POST",
    });
  }

  /**
   * Resend the callback for a payout that has reached a final state.
   */
  async resendCallback(payoutId: string): Promise<void> {
    validatePaymentId(payoutId, "payoutId");
    await this.http.request<void>(
      `/v2/payouts/${payoutId}/resend-callback`,
      { method: "POST" }
    );
  }

  /**
   * Convenience helper: generates a new UUIDv4 `payoutId` for you.
   * Store this in your DB *before* calling `initiate()`.
   */
  generateId(): string {
    return generateUUID();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validateSingle(req: PayoutRequest, index?: number): PayoutRequest {
    const ctx = index !== undefined ? `payouts[${index}].` : "";
    validatePaymentId(req.payoutId, `${ctx}payoutId`);
    validateAmount(req.amount, `${ctx}amount`);
    
    if (req.recipient && req.recipient.type === "MMO") {
      req.recipient.accountDetails = resolveAccountDetails(req.recipient.accountDetails);
    }
    
    if (req.customerMessage) validateCustomerMessage(req.customerMessage);
    if (req.metadata) validateMetadata(req.metadata);
    if (!req.currency || req.currency.length !== 3) {
      throw new PawaPayValidationError(
        `${ctx}currency must be a 3-character ISO 4217 code (got "${req.currency}").`,
        `${ctx}currency`
      );
    }
    return req;
  }
}
