// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Validators
//  Runs before any HTTP call leaves the SDK.
// ─────────────────────────────────────────────

import { PawaPayValidationError } from "../errors";

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
    throw new PawaPayValidationError(
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
    throw new PawaPayValidationError(
      "Amount must be a finite number. Do not pass formatted strings (e.g. '1,000')."
    );
  }
  if (!Number.isInteger(amount)) {
    throw new PawaPayValidationError(
      "Amount must be a whole number (no decimals). UGX does not use fractional units."
    );
  }
  if (amount < min) {
    throw new PawaPayValidationError(
      `Amount must be at least UGX ${min.toLocaleString("en-UG")}.`
    );
  }
  if (amount > AMOUNT_MAX) {
    throw new PawaPayValidationError(
      `Amount must not exceed UGX ${AMOUNT_MAX.toLocaleString("en-UG")}.`
    );
  }
}