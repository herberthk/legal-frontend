// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Fee Calculator
// ─────────────────────────────────────────────────────────────────────────────

import { PawaPayValidationError } from "../errors";

// ── Country-specific fee schedules ────────────────────────────────────────────

/**
 * Supported countries for fee calculation.
 * More countries can be added here as PawaPay expands.
 */
export type FeeCountry = "UGA";

/**
 * Fee schedule for a single country.
 *
 * @property percentageFee  - Percentage of the transaction amount charged (0–100)
 * @property fixedFee       - Optional flat fee added regardless of amount
 * @property currency       - ISO 4217 currency code
 * @property minFee         - Optional minimum fee (floor) in currency units
 * @property maxFee         - Optional maximum fee (cap) in currency units
 * @property decimals       - Decimal precision used to round fee & total amounts
 */
export interface FeeSchedule {
  percentageFee: number;
  fixedFee: number;
  currency: string;
  minFee?: number;
  maxFee?: number;
  decimals: number;
}

/**
 * All country fee schedules.
 * Uganda: 3% of transaction amount, no fixed fee, no min/max cap.
 * Amounts are whole-number UGX (0 decimals).
 */
export const FEE_SCHEDULES: Record<FeeCountry, FeeSchedule> = {
  UGA: {
    percentageFee: 3,
    fixedFee: 0,
    currency: "UGX",
    decimals: 0,
  },
} as const;

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * The result returned by `calculateFee`.
 */
export interface FeeResult {
  /** The original transaction amount supplied by the caller */
  amount: number;
  /** The computed platform fee */
  fee: number;
  /** The total the customer will be charged (amount + fee) */
  total: number;
  /** Currency of all monetary values */
  currency: string;
  /** Country the schedule was applied for */
  country: FeeCountry;
  /** Percentage rate that was applied (e.g. 3 for 3%) */
  percentageRate: number;
  /** Fixed fee component (usually 0) */
  fixedFee: number;
  /** Human-readable summary string */
  formatted: string;
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculates the PawaPay platform fee for a transaction.
 *
 * @param amount  - Transaction amount in the country's currency (must be > 0)
 * @param country - ISO country code (currently only `"UGA"` is supported)
 * @returns       A `FeeResult` with fee, total, and a formatted summary
 *
 * @throws {PawaPayValidationError} if `amount` is not a positive finite number
 * @throws {PawaPayValidationError} if `country` is not supported
 *
 * @example
 * ```ts
 * import { calculateFee } from "pawapay-sdk";
 *
 * const result = calculateFee(150_000, "UGA");
 * // result.fee     → 4500
 * // result.total   → 154500
 * // result.formatted → "UGX 150,000 + UGX 4,500 fee (3%) = UGX 154,500 total"
 * ```
 */
export function calculateFee(amount: number, country: FeeCountry): FeeResult {
  // ── Validate amount ──────────────────────────────────────────────────────
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PawaPayValidationError(
      `calculateFee: amount must be a positive finite number (got ${amount}).`,
      "amount"
    );
  }

  // ── Validate country ─────────────────────────────────────────────────────
  if (!(country in FEE_SCHEDULES)) {
    const supported = Object.keys(FEE_SCHEDULES).join(", ");
    throw new PawaPayValidationError(
      `calculateFee: unsupported country "${country}". Supported: ${supported}.`,
      "country"
    );
  }

  const schedule = FEE_SCHEDULES[country];
  const { percentageFee, fixedFee, currency, decimals, minFee, maxFee } =
    schedule;

  // ── Compute fee ──────────────────────────────────────────────────────────
  let rawFee = amount * (percentageFee / 100) + fixedFee;

  // Apply min/max caps if defined
  if (minFee !== undefined) rawFee = Math.max(rawFee, minFee);
  if (maxFee !== undefined) rawFee = Math.min(rawFee, maxFee);

  // Round to the currency's decimal precision
  const multiplier = Math.pow(10, decimals);
  const fee = Math.round(rawFee * multiplier) / multiplier;
  const total = Math.round((amount + fee) * multiplier) / multiplier;

  // ── Format summary ───────────────────────────────────────────────────────
  const fmt = (n: number) =>
    `${currency} ${n.toLocaleString("en-UG", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;

  const formatted = `${fmt(amount)} + ${fmt(fee)} fee (${percentageFee}%) = ${fmt(total)} total`;

  return {
    amount,
    fee,
    total,
    currency,
    country,
    percentageRate: percentageFee,
    fixedFee,
    formatted,
  };
}

// ── Convenience: amount the merchant receives (total minus fee) ───────────────

/**
 * Returns the net amount the merchant receives after PawaPay deducts its fee.
 * Useful when you want to quote the customer a gross amount but need to know
 * your net proceeds.
 *
 * @example
 * ```ts
 * const net = netAmount(150_000, "UGA"); // 145_500
 * ```
 */
export function netAmount(amount: number, country: FeeCountry): number {
  const { fee } = calculateFee(amount, country);
  return amount - fee;
}
