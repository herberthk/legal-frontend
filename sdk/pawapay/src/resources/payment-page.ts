// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Payment Page Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  PaymentPageDepositRequest,
  PaymentPageDepositResponse,
} from "../types";
import {
  validatePaymentId,
  validateAmount,
  validateCustomerMessage,
  validateMetadata,
  generateUUID,
} from "../utils";
import { PawaPayValidationError } from "../errors";

export class PaymentPageResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a hosted Payment Page deposit session.
   *
   * The response includes a `redirectUrl` — send the customer to this URL
   * to complete payment via pawaPay's hosted checkout UI.
   *
   * @example
   * ```ts
   * const depositId = pawapay.paymentPage.generateId();
   * // persist depositId to DB here
   * const { redirectUrl } = await pawapay.paymentPage.createDeposit({
   *   depositId,
   *   amount: '5000',
   *   currency: 'UGX',
   *   returnUrl: 'https://yourapp.com/payment/complete',
   * });
   * // Redirect user to redirectUrl
   * ```
   */
  async createDeposit(
    request: PaymentPageDepositRequest
  ): Promise<PaymentPageDepositResponse> {
    this.validate(request);
    return this.http.request<PaymentPageDepositResponse>(
      "/v2/widget/sessions",
      {
        method: "POST",
        body: request,
      }
    );
  }

  /**
   * Convenience helper: generates a new UUIDv4 `depositId` for you.
   * Store this in your DB *before* calling `createDeposit()`.
   */
  generateId(): string {
    return generateUUID();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  private validate(req: PaymentPageDepositRequest): void {
    validatePaymentId(req.depositId, "depositId");
    validateAmount(req.amount);
    if (!req.currency || req.currency.length !== 3) {
      throw new PawaPayValidationError(
        `currency must be a 3-character ISO 4217 code (got "${req.currency}").`,
        "currency"
      );
    }
    if (req.customerMessage) validateCustomerMessage(req.customerMessage);
    if (req.metadata) validateMetadata(req.metadata);
  }
}
