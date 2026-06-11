// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – PawaPayClient  (main entry point)
// ─────────────────────────────────────────────────────────────────────────────

import type { MsisdnData, PawaPayConfig } from "./types";
import { HttpClient } from "./http-client";
import { DepositsResource } from "./resources/deposits";
import { PayoutsResource } from "./resources/payouts";
import { RefundsResource } from "./resources/refunds";
import { RemittancesResource } from "./resources/remittances";
import { ToolkitResource } from "./resources/toolkit";
import { FinancesResource } from "./resources/finances";
import { PaymentPageResource } from "./resources/payment-page";

import {
  calculateFee as _calculateFee,
  netAmount as _netAmount,
} from "./utils/fees";
import type { FeeCountry, FeeResult } from "./utils/fees";
import { MsisdnResource } from "./resources/msisdn";

export type { PawaPayConfig } from "./types";

/**
 * PawaPayClient — the root SDK object.
 *
 * Instantiate once at application startup and reuse across requests.
 * All resource instances are lazy-initialised on first access.
 *
 * @example
 * ```ts
 * import { PawaPayClient } from 'pawapay-sdk';
 *
 * const pawapay = new PawaPayClient({
 *   apiToken: process.env.PAWAPAY_API_TOKEN!,
 *   environment: 'production',   // or 'sandbox' (default)
 *   timeout: 30_000,
 *   maxRetries: 3,
 * });
 *
 * // Deposits
 * const depositId = pawapay.deposits.generateId();
 * const deposit = await pawapay.deposits.initiate({ depositId, ... });
 *
 * // Payouts
 * const payoutId = pawapay.payouts.generateId();
 * const payout = await pawapay.payouts.initiate({ payoutId, ... });
 *
 * // Toolkit
 * const prediction = await pawapay.toolkit.predictProvider({ phoneNumber: '+256700123456' });
 * ```
 */
export class PawaPayClient {
  private readonly _http: HttpClient;

  // Lazy resource singletons
  private _deposits?: DepositsResource;
  private _payouts?: PayoutsResource;
  private _refunds?: RefundsResource;
  private _remittances?: RemittancesResource;
  private _toolkit?: ToolkitResource;
  private _finances?: FinancesResource;
  private _paymentPage?: PaymentPageResource;
  private _verifyMsdn?: MsisdnResource 

  constructor(config: PawaPayConfig) {
    if (!config.apiToken || typeof config.apiToken !== "string") {
      throw new Error(
        "PawaPayClient: apiToken is required and must be a non-empty string."
      );
    }
    this._http = new HttpClient(config);
  }

  /** Deposit (collect from customer) operations */
  get deposits(): DepositsResource {
    return (this._deposits ??= new DepositsResource(this._http));
  }

  /** Payout (send to customer) operations */
  get payouts(): PayoutsResource {
    return (this._payouts ??= new PayoutsResource(this._http));
  }

  /** Refund (reverse a completed deposit) operations */
  get refunds(): RefundsResource {
    return (this._refunds ??= new RefundsResource(this._http));
  }

  /** Remittance (cross-border payout) operations */
  get remittances(): RemittancesResource {
    return (this._remittances ??= new RemittancesResource(this._http));
  }

  /**
   * Toolkit: predict provider, active configuration, availability,
   * and public keys.
   */
  get toolkit(): ToolkitResource {
    return (this._toolkit ??= new ToolkitResource(this._http));
  }

  /** Finance operations: wallet balances and statements */
  get finances(): FinancesResource {
    return (this._finances ??= new FinancesResource(this._http));
  }

  /** Hosted Payment Page sessions */
  get paymentPage(): PaymentPageResource {
    return (this._paymentPage ??= new PaymentPageResource(this._http));
  }

  /**
   * 
   * 
   * Verifies the name associated with a Ugandan mobile money number.
   *
   * @param msisdn  - The mobile number to verify, in MSISDN format (e.g., "+256770123456").
   *
   * @returns A promise that resolves to a {@link VerifyMsisdnResponse} object
   *          containing the name verification result.
   *
   * @throws {@link PawaPayValidationError} if the msisdn is invalid.
   * @throws {@link PawaPayAPIError} if the API request fails.
   *
   * @example
   * ```ts
   * // Initialize the client
   * const pawapay = new PawaPayClient({
   *   apiToken: 'your-api-token',
   *   environment: 'sandbox',
   * });
   *
   * try {
   *   // Verify a mobile number
   *   const result = await pawapay.msisdn.verify('+256770123456');
   *
   *   // Display the result
   *   console.log('Name:', result.name);
   *   console.log('Status:', result.status);
   *   console.log('Reason:', result.reason);
   * } catch (error) {
   *   console.error('Error verifying MSISDN:', error);
   * }
   * ```
   */
  get msisdn(): MsisdnResource {
    return (this._verifyMsdn ??= new MsisdnResource());
  }

  // ── Fee helpers ─────────────────────────────────────────────────────────────

  /**
   * Calculates the PawaPay platform fee for a transaction.
   *
   * @param amount  - Transaction amount in the country's currency (must be > 0)
   * @param country - ISO country code. Currently supported: `"UGA"`
   * @returns       A {@link FeeResult} with `fee`, `total`, `currency`, and a
   *                human-readable `formatted` summary string.
   *
   * @throws {PawaPayValidationError} if `amount` ≤ 0 or is not finite
   * @throws {PawaPayValidationError} if `country` is not supported
   *
   * @example
   * ```ts
   * const result = pawapay.calculateFee(150_000, "UGA");
   * console.log(result.fee);       // 4500
   * console.log(result.total);     // 154500
   * console.log(result.formatted); // "UGX 150,000 + UGX 4,500 fee (3%) = UGX 154,500 total"
   * ```
   */
  calculateFee(amount: number, country: FeeCountry = 'UGA'): FeeResult {
    return _calculateFee(amount, country);
  }

  /**
   * Returns the net amount the merchant receives after PawaPay deducts its fee.
   *
   * @example
   * ```ts
   * const net = pawapay.netAmount(150_000, "UGA"); // 145_500
   * ```
   */
  netAmount(amount: number, country: FeeCountry): number {
    return _netAmount(amount, country);
  }
}
