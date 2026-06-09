// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Refunds Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  RefundRequest,
  RefundInitiationResponse,
  RefundStatusResponse,
} from "../types";
import {
  validatePaymentId,
  validateAmount,
  validateMetadata,
  generateUUID,
} from "../utils";
import { PawaPayValidationError } from "../errors";

export class RefundsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate a refund for a completed deposit.
   *
   * - The original deposit must be in COMPLETED status.
   * - Idempotent: safe to retry with the same `refundId`.
   * - Requires sufficient balance in your pawaPay wallet.
   * - Store `refundId` in your database **before** calling this method.
   *
   * @example
   * ```ts
   * const refundId = pawapay.refunds.generateId();
   * // persist refundId to DB here
   * const result = await pawapay.refunds.initiate({
   *   refundId,
   *   depositId: 'original-deposit-uuid',
   *   amount: '5000',
   *   currency: 'UGX',
   * });
   * ```
   */
  async initiate(request: RefundRequest): Promise<RefundInitiationResponse> {
    this.validate(request);
    return this.http.request<RefundInitiationResponse>("/v2/refunds", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Check the current status of a refund.
   */
  async checkStatus(refundId: string): Promise<RefundStatusResponse> {
    validatePaymentId(refundId, "refundId");
    return this.http.request<RefundStatusResponse>(`/v2/refunds/${refundId}`);
  }

  /**
   * Resend the callback for a refund that has reached a final state.
   */
  async resendCallback(refundId: string): Promise<void> {
    validatePaymentId(refundId, "refundId");
    await this.http.request<void>(
      `/v2/refunds/${refundId}/resend-callback`,
      { method: "POST" }
    );
  }

  /**
   * Convenience helper: generates a new UUIDv4 `refundId` for you.
   * Store this in your DB *before* calling `initiate()`.
   */
  generateId(): string {
    return generateUUID();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(req: RefundRequest): void {
    validatePaymentId(req.refundId, "refundId");
    validatePaymentId(req.depositId, "depositId");
    validateAmount(req.amount);
    if (!req.currency || req.currency.length !== 3) {
      throw new PawaPayValidationError(
        `currency must be a 3-character ISO 4217 code (got "${req.currency}").`,
        "currency"
      );
    }
    if (req.metadata) validateMetadata(req.metadata);
  }
}
