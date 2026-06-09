// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Validators
//  Runs before any HTTP call leaves the SDK.
// ─────────────────────────────────────────────

import { SsentezoValidationError } from "./errors";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Uganda international dialling prefix + 9 digits */
const MSISDN_RE = /^256\d{9}$/;

export const AMOUNT_MIN = 500;
export const AMOUNT_MAX = 7_000_000;
export const BANK_TRANSFER_AMOUNT_MIN = 50_000;
export const EXTERNAL_REF_MAX_LENGTH = 250;

// ── Validators ────────────────────────────────────────────────────────────────

/**
 * Validate a phone number in Ugandan international format.
 * Must start with 256 followed by exactly 9 digits (e.g. 256709920188).
 */
export function validateMsisdn(msisdn: unknown): void {
  if (typeof msisdn !== "string" || !MSISDN_RE.test(msisdn)) {
    throw new SsentezoValidationError(
      `Invalid MSISDN "${msisdn}". ` +
        "Must be in international format starting with 256 followed by 9 digits " +
        "(e.g. 256709920188)."
    );
  }
}

/**
 * Validate a transaction amount.
 * @param amount   The value to validate.
 * @param minAmount Override the minimum (default: UGX 500, bank transfers use 50,000).
 */
export function validateAmount(
  amount: unknown,
  opts: { minAmount?: number } = {}
): void {
  const min = opts.minAmount ?? AMOUNT_MIN;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new SsentezoValidationError(
      "Amount must be a finite number. Do not pass formatted strings (e.g. '1,000')."
    );
  }
  if (!Number.isInteger(amount)) {
    throw new SsentezoValidationError(
      "Amount must be a whole number (no decimals). UGX does not use fractional units."
    );
  }
  if (amount < min) {
    throw new SsentezoValidationError(
      `Amount must be at least UGX ${min.toLocaleString("en-UG")}.`
    );
  }
  if (amount > AMOUNT_MAX) {
    throw new SsentezoValidationError(
      `Amount must not exceed UGX ${AMOUNT_MAX.toLocaleString("en-UG")}.`
    );
  }
}

/**
 * Validate an external / transaction reference.
 */
export function validateExternalReference(ref: unknown): void {
  if (!ref || typeof ref !== "string" || ref.trim().length === 0) {
    throw new SsentezoValidationError("externalReference is required.");
  }
  if (ref.length > EXTERNAL_REF_MAX_LENGTH) {
    throw new SsentezoValidationError(
      `externalReference must be at most ${EXTERNAL_REF_MAX_LENGTH} characters ` +
        `(got ${ref.length}).`
    );
  }
}

/**
 * Validate an optional callback URL.
 * Must be a valid HTTP or HTTPS URL when provided.
 */
export function validateCallbackUrl(
  url: unknown,
  field: string
): void {
  if (url === undefined || url === null) return;

  if (typeof url !== "string") {
    throw new SsentezoValidationError(`${field} must be a string URL.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsentezoValidationError(
      `${field} is not a valid URL: "${url}".`
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new SsentezoValidationError(
      `${field} must use HTTP or HTTPS (got "${parsed.protocol}").`
    );
  }
}

/**
 * Validate a bank ID (must be a positive integer).
 */
export function validateBankId(bankId: unknown): void {
  if (
    typeof bankId !== "number" ||
    !Number.isInteger(bankId) ||
    bankId <= 0
  ) {
    throw new SsentezoValidationError(
      "bankId must be a positive integer. Use the value from getBanks()."
    );
  }
}
