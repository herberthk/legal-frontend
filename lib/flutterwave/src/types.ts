// ─────────────────────────────────────────────────────────────────────────────
// types.ts — All shared types for the Uganda Flutterwave v4 SDK
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums / Unions ────────────────────────────────────────────────────────────

export type UgandaNetwork = "MTN" | "AIRTEL";
export type PaymentMethodType = "mobile_money" | "card" | "bank";
export type ChargeStatus = "pending" | "successful" | "failed";
export type Environment = "sandbox" | "live";

export type FeeType = "vat" | "app" | "merchant" | "stamp_duty" | string;

// ── Config ────────────────────────────────────────────────────────────────────

export interface FlwUgSdkConfig {
  /**
   * OAuth2 client ID from the Flutterwave dashboard.
   * Used to exchange for a short-lived access token automatically.
   */
  clientId: string;
  /**
   * OAuth2 client secret from the Flutterwave dashboard.
   * Never expose this in browser/frontend code.
   */
  clientSecret: string;
  /**
   * AES-256 encryption key from the Flutterwave dashboard API settings.
   * Required only for card payments.
   */
  encryptionKey?: string;
  /** "sandbox" (default) | "live" */
  environment?: Environment;
  /**
   * Optional per-transaction webhook URL override.
   * If omitted, Flutterwave uses the URL configured in your dashboard — which
   * is the recommended approach. Only set this for per-charge routing.
   */
  callbackUrl?: string;
  /**
   * Optional default redirect URL for 3DS card flows and mobile money
   * confirmation pages. Can also be passed per-charge.
   */
  redirectUrl?: string;
  /** Override the request timeout in ms (default: 30_000) */
  timeoutMs?: number;
}

// ── Customer ──────────────────────────────────────────────────────────────────

export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  /** Full Uganda phone number: 0772123456 | +256772123456 */
  phone?: string;
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  type: FeeType;
  amount: number;
}

export interface FeeInfo {
  /** What the merchant originally requested */
  baseAmount: number;
  /** Total fee the customer will pay on top */
  totalFee: number;
  /** Amount Flutterwave will actually charge the customer */
  chargeAmount: number;
  /** Itemised breakdown (VAT, app fee, merchant fee, stamp duty…) */
  breakdown: FeeBreakdown[];
}

// ── Phone validation ──────────────────────────────────────────────────────────

export interface PhoneValidationResult {
  valid: boolean;
  /** 9-digit local form, e.g. "772123456" */
  normalized?: string;
  network?: UgandaNetwork;
  /** E.164 format, e.g. "+256772123456" */
  e164?: string;
  error?: string;
}

// ── Card encryption ───────────────────────────────────────────────────────────

export interface RawCardDetails {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface EncryptedCardDetails {
  nonce: string;
  encrypted_card_number: string;
  encrypted_expiry_month: string;
  encrypted_expiry_year: string;
  encrypted_cvv: string;
}

// ── Charge inputs ─────────────────────────────────────────────────────────────

export interface BaseChargeInput {
  amount: number;
  customer: CustomerInfo;
  /** Unique per transaction. Auto-generated if omitted. */
  reference?: string;
  narration?: string;
  meta?: Record<string, unknown>;
}

export interface MobileMoneyChargeInput extends BaseChargeInput {
  type: "mobile_money";
  /** Full Uganda phone number */
  phoneNumber: string;
  /** Auto-detected from prefix if omitted */
  network?: UgandaNetwork;
}

export interface CardChargeInput extends BaseChargeInput {
  type: "card";
  card: RawCardDetails;
}

export interface BankChargeInput extends BaseChargeInput {
  type: "bank";
  /** Account bank code, e.g. "STANBIC" */
  accountBank: string;
}

export type ChargeInput =
  | MobileMoneyChargeInput
  | CardChargeInput
  | BankChargeInput;

// ── next_action from Flutterwave ──────────────────────────────────────────────

export type NextActionType =
  | "requires_pin"
  | "requires_otp"
  | "redirect"
  | "requires_additional_fields"
  | "payment_instruction"
  | "none";

export interface NextAction {
  type: NextActionType;
  /** Redirect URL for 3DS or mobile money confirmation */
  redirectUrl?: string;
  /** Human-readable instruction to show the user */
  instruction?: string;
  /** Raw authorization object to pass back via authorizeCharge() */
  raw?: Record<string, unknown>;
}

// ── Charge result ─────────────────────────────────────────────────────────────

export interface ChargeResult {
  chargeId: string;
  reference: string;
  status: ChargeStatus;
  /** Amount Flutterwave will debit (baseAmount + fees) */
  chargeAmount: number;
  currency: "UGX";
  fees: FeeInfo;
  nextAction: NextAction;
  /** ISO timestamp */
  createdAt: string;
}

// ── Authorization inputs (card 2FA) ───────────────────────────────────────────

export interface PinAuthorization {
  type: "pin";
  pin: string;
}

export interface OtpAuthorization {
  type: "otp";
  code: string;
}

export interface AvsAuthorization {
  type: "avs";
  address: {
    city: string;
    country: string;
    line1: string;
    line2?: string;
    postalCode: string;
    state: string;
  };
}

export type AuthorizationInput =
  | PinAuthorization
  | OtpAuthorization
  | AvsAuthorization;

// ── Verification ──────────────────────────────────────────────────────────────

export interface VerificationResult {
  chargeId: string;
  reference: string;
  status: ChargeStatus;
  amount: number;
  currency: "UGX";
  customerId: string;
  paymentMethodId: string;
  updatedAt: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type FlwErrorCode =
  | "INVALID_PHONE"
  | "INVALID_NETWORK"
  | "MISSING_ENCRYPTION_KEY"
  | "ENCRYPTION_FAILED"
  | "TOKEN_FETCH_FAILED"
  | "API_ERROR"
  | "TIMEOUT"
  | "VERIFICATION_FAILED"
  | "UNKNOWN";

export interface FlwUgError {
  code: FlwErrorCode;
  message: string;
  httpStatus?: number;
  raw?: unknown;
}
