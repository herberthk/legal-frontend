// ─────────────────────────────────────────────────────────────────────────────
// sdk.ts — FlwUganda: the main SDK class
//
// Usage:
//   import { FlwUganda } from "flw-ug-sdk";
//   const flw = new FlwUganda({ clientId: "...", clientSecret: "...", encryptionKey: "..." });
// ─────────────────────────────────────────────────────────────────────────────

import type {
  FlwUgSdkConfig,
  ChargeInput,
  ChargeResult,
  AuthorizationInput,
  VerificationResult,
  UgandaNetwork,
  PhoneValidationResult,
  FeeInfo,
} from "./types";

import { validateUgandaPhone, detectUgandaNetwork } from "./phone";
import { encryptCard } from "./crypto";
import { apiRequest, TokenManager, FlwUgSdkError } from "./http";
import { parseFees, formatFeeDisplay } from "./fees";
import {
  buildMobileMoneyPayload,
  buildCardPayload,
  buildBankPayload,
  buildAuthorizationPayload,
} from "./payload";
import { normalizeChargeResponse, normalizeVerifyResponse } from "./normalize";

// ── Reference generator ───────────────────────────────────────────────────────

/**
 * Generate a unique transaction reference.
 * @param prefix - Optional prefix, e.g. "LGL" → "LGL-M8K4A-X9F2R1"
 */
export function generateTxRef(prefix = "FLW"): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ── Main SDK class ────────────────────────────────────────────────────────────

export class FlwUganda {
  private readonly baseUrl: string;
  private readonly tokenManager: TokenManager;
  private readonly config: FlwUgSdkConfig & { timeoutMs: number; environment: string };

  constructor(config: FlwUgSdkConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new FlwUgSdkError({
        code: "API_ERROR",
        message: "FlwUganda: clientId and clientSecret are required.",
      });
    }

    this.config = {
      timeoutMs: 30_000,
      environment: "sandbox",
      ...config,
    };

    this.baseUrl =
      this.config.environment === "live"
        ? "https://api.flutterwave.com"
        : "https://developersandbox-api.flutterwave.com";

    // TokenManager handles OAuth2 token fetching and auto-refresh internally.
    // Tokens expire every 10 minutes; manager proactively refreshes with 60 s buffer.
    this.tokenManager = new TokenManager(
      config.clientId,
      config.clientSecret,
      this.config.timeoutMs
    );
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private get<T>(path: string): Promise<T> {
    return apiRequest<T>("GET", this.url(path), this.tokenManager, undefined, this.config.timeoutMs);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return apiRequest<T>("POST", this.url(path), this.tokenManager, body, this.config.timeoutMs);
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return apiRequest<T>("PUT", this.url(path), this.tokenManager, body, this.config.timeoutMs);
  }

  // ── Phone utilities (exposed for your UI) ──────────────────────────────────

  /**
   * Validate a Uganda phone number. Call this before showing your payment form
   * so you can display the detected network to the user.
   *
   * @example
   * const r = flw.phone.validate("0772123456");
   * // { valid: true, network: "MTN", e164: "+256772123456" }
   */
  readonly phone = {
    validate: (phone: string): PhoneValidationResult =>
      validateUgandaPhone(phone),

    detectNetwork: (phone: string): UgandaNetwork | null =>
      detectUgandaNetwork(phone),
  };

  // ── Fee preview ─────────────────────────────────────────────────────────────

  /**
   * Preview fees for an amount before initiating a charge.
   * Calls the Flutterwave fee endpoint for an accurate breakdown.
   *
   * ⚠️  Fee amounts returned here are advisory — the definitive fee is
   * in the ChargeResult returned from charge(). Always use that for
   * display after initiation.
   *
   * @example
   * const fee = await flw.previewFees(10000, "mobile_money");
   * console.log(flw.formatFee(fee));
   * // "UGX 10,000 + UGX 150 fee = UGX 10,150 total"
   */
  async previewFees(
    amount: number,
    type: "mobile_money" | "card" | "bank" = "mobile_money"
  ): Promise<FeeInfo> {
    // Map our type to Flutterwave ptype values
    const ptypeMap: Record<string, string> = {
      mobile_money: "2",
      card: "1",
      bank: "3",
    };

    interface FeeRaw {
      charge_amount: number;
      fee: number;
      merchantfee: number;
      ravefee: number;
    }

    const data = await this.get<FeeRaw>(
      `/transactions/fee?amount=${amount}&currency=UGX&payment_type=${ptypeMap[type] ?? "2"}`
    );

    // Build a synthetic breakdown from the flat response
    const breakdown = [
      { type: "app", amount: data.ravefee ?? 0 },
      ...(data.merchantfee > 0 ? [{ type: "merchant", amount: data.merchantfee }] : []),
    ];

    return parseFees(amount, breakdown);
  }

  /**
   * Format a FeeInfo into a human-readable display string for your UI.
   */
  formatFee(fee: FeeInfo): string {
    return formatFeeDisplay(fee);
  }

  // ── Core: charge ────────────────────────────────────────────────────────────

  /**
   * Initiate a payment via the Flutterwave v4 Orchestrator.
   * Fees are added on top of the requested amount — the customer pays all fees.
   *
   * Handles mobile money, card (with AES-GCM encryption), and bank (USSD).
   *
   * @returns ChargeResult with chargeAmount (base + fees), nextAction,
   *          and a complete FeeInfo breakdown ready to display to the user.
   *
   * @example — Mobile Money
   * const result = await flw.charge({
   *   type: "mobile_money",
   *   amount: 10_000,
   *   phoneNumber: "0772123456",
   *   customer: { email: "john@example.com", firstName: "John", lastName: "Mukasa" },
   *   narration: "LegalAdviser – Monthly plan",
   * });
   *
   * @example — Card
   * const result = await flw.charge({
   *   type: "card",
   *   amount: 50_000,
   *   card: { cardNumber: "4111111111111111", expiryMonth: "01", expiryYear: "26", cvv: "123" },
   *   customer: { email: "jane@example.com", firstName: "Jane", lastName: "Akello" },
   * });
   */
  async charge(input: ChargeInput): Promise<ChargeResult> {
    const reference = input.reference ?? generateTxRef();

    // 1. Preview fees to compute chargeAmount before calling orchestrator
    const feeInfo = await this.previewFees(input.amount, input.type);
    const chargeAmount = feeInfo.chargeAmount;

    // 2. Build orchestrator payload based on payment type
    let payload: Record<string, unknown>;

    if (input.type === "mobile_money") {
      payload = buildMobileMoneyPayload(
        input,
        chargeAmount,
        reference,
        this.config.callbackUrl,
        this.config.redirectUrl
      );
    } else if (input.type === "card") {
      if (!this.config.encryptionKey) {
        throw new FlwUgSdkError({
          code: "MISSING_ENCRYPTION_KEY",
          message: "encryptionKey is required in FlwUgSdkConfig to process card payments.",
        });
      }
      let encrypted;
      try {
        encrypted = await encryptCard(input.card, this.config.encryptionKey);
      } catch (err) {
        throw new FlwUgSdkError({
          code: "ENCRYPTION_FAILED",
          message: `Card encryption failed: ${(err as Error).message}`,
          raw: err,
        });
      }
      payload = buildCardPayload(
        input,
        encrypted,
        chargeAmount,
        reference,
        this.config.callbackUrl,
        this.config.redirectUrl
      );
    } else if (input.type === "bank") {
      payload = buildBankPayload(
        input,
        chargeAmount,
        reference,
        this.config.callbackUrl,
        this.config.redirectUrl
      );
    } else {
      throw new FlwUgSdkError({
        code: "UNKNOWN",
        message: `Unsupported payment type: ${(input as ChargeInput).type}`,
      });
    }

    // 3. POST to orchestrator
    const raw = await this.post<Record<string, unknown>>(
      "/orchestration/direct-charges",
      payload
    );

    // 4. Normalize into clean ChargeResult
    return normalizeChargeResponse(
      //@ts-ignore
      raw as Parameters<typeof normalizeChargeResponse>[0],
      input.amount
    );
  }

  // ── Card 2FA: authorize ────────────────────────────────────────────────────

  /**
   * Submit a card authorization (PIN, OTP, or AVS) after a charge that
   * returns nextAction.type = "requires_pin" | "requires_otp" | "requires_additional_fields".
   *
   * @example — PIN
   * await flw.authorize(chargeId, { type: "pin", pin: "1234" });
   *
   * @example — OTP
   * await flw.authorize(chargeId, { type: "otp", code: "654321" });
   */
  async authorize(
    chargeId: string,
    auth: AuthorizationInput
  ): Promise<ChargeResult> {
    let encryptField: ((v: string) => Promise<string>) | undefined;
    let nonce: string | undefined;

    // For PIN, we need to encrypt the PIN field using a fresh nonce
    if (auth.type === "pin" && this.config.encryptionKey) {
      nonce = Array.from({ length: 12 }, () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[
          Math.floor(Math.random() * 62)
        ]
      ).join("");

      const key = this.config.encryptionKey;
      encryptField = async (value: string) => {
        const crypto =
          globalThis.crypto ??
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("crypto") as { webcrypto: Crypto }).webcrypto;
        const keyBytes = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
        const iv = new TextEncoder().encode(nonce);
        const cryptoKey = await crypto.subtle.importKey(
          "raw",
          keyBytes,
          { name: "AES-GCM" },
          false,
          ["encrypt"]
        );
        const buf = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          cryptoKey,
          new TextEncoder().encode(value)
        );
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
      };
    }

    const body = await buildAuthorizationPayload(auth, encryptField, nonce);

    const raw = await this.put<Record<string, unknown>>(
      `/charges/${chargeId}`,
      body
    );

    return normalizeChargeResponse(
       //@ts-ignore
      raw as Parameters<typeof normalizeChargeResponse>[0],
      0 // amount already set; fees are already baked in
    );
  }

  // ── Verify ──────────────────────────────────────────────────────────────────

  /**
   * Verify a charge by its ID. **Always call this before fulfilling an order.**
   * Never trust the client-side result alone without server-side verification.
   *
   * Optionally pass expectedAmount — throws VERIFICATION_FAILED if it doesn't
   * match, so you never accidentally fulfil an underpaid order.
   *
   * @example
   * const v = await flw.verify(chargeId, { expectedAmount: 10_150 });
   * if (v.status === "successful") {
   *   // Fulfil the order
   * }
   */
  async verify(
    chargeId: string,
    options?: { expectedAmount?: number }
  ): Promise<VerificationResult> {
    const raw = await this.get<Record<string, unknown>>(`/charges/${chargeId}`);
    const result = normalizeVerifyResponse(
       //@ts-ignore
      raw as Parameters<typeof normalizeVerifyResponse>[0]
    );

    if (options?.expectedAmount !== undefined) {
      if (result.amount !== options.expectedAmount) {
        throw new FlwUgSdkError({
          code: "VERIFICATION_FAILED",
          message:
            `Amount mismatch: expected ${options.expectedAmount} UGX, ` +
            `got ${result.amount} UGX. Do not fulfil this order.`,
          raw: result,
        });
      }
    }

    return result;
  }
}

// ── Re-export everything consumers need ───────────────────────────────────────

export * from "./http";
export * from "./fees";
export * from "./phone";
