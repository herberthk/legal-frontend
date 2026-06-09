// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Remittances Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  RemittanceRequest,
  RemittanceInitiationResponse,
} from "../types";
import {
  validatePaymentId,
  validateAmount,
  validatePhoneNumber,
  validateCustomerMessage,
  validateMetadata,
  generateUUID,
} from "../utils";
import { PawaPayValidationError } from "../errors";

export class RemittancesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate a remittance (cross-border payout).
   *
   * - Idempotent: safe to retry with the same `remittanceId`.
   * - Store `remittanceId` in your database **before** calling this method.
   */
  async initiate(
    request: RemittanceRequest
  ): Promise<RemittanceInitiationResponse> {
    this.validate(request);
    return this.http.request<RemittanceInitiationResponse>("/v2/remittances", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Check the current status of a remittance.
   */
  async checkStatus(remittanceId: string): Promise<RemittanceInitiationResponse> {
    validatePaymentId(remittanceId, "remittanceId");
    return this.http.request<RemittanceInitiationResponse>(
      `/v2/remittances/${remittanceId}`
    );
  }

  /**
   * Cancel a remittance that is in ENQUEUED state.
   */
  async cancelEnqueued(remittanceId: string): Promise<void> {
    validatePaymentId(remittanceId, "remittanceId");
    await this.http.request<void>(`/v2/remittances/${remittanceId}/cancel`, {
      method: "POST",
    });
  }

  /**
   * Resend the callback for a remittance that has reached a final state.
   */
  async resendCallback(remittanceId: string): Promise<void> {
    validatePaymentId(remittanceId, "remittanceId");
    await this.http.request<void>(
      `/v2/remittances/${remittanceId}/resend-callback`,
      { method: "POST" }
    );
  }

  /**
   * Convenience helper: generates a new UUIDv4 `remittanceId` for you.
   * Store this in your DB *before* calling `initiate()`.
   */
  generateId(): string {
    return generateUUID();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(req: RemittanceRequest): void {
    validatePaymentId(req.remittanceId, "remittanceId");
    validateAmount(req.amount);
    validatePhoneNumber(req.recipient.accountDetails.phoneNumber);
    if (req.customerMessage) validateCustomerMessage(req.customerMessage);
    if (req.metadata) validateMetadata(req.metadata);
    if (!req.currency || req.currency.length !== 3) {
      throw new PawaPayValidationError(
        `currency must be a 3-character ISO 4217 code (got "${req.currency}").`,
        "currency"
      );
    }
  }
}
