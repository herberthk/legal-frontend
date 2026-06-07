// ─────────────────────────────────────────────────────────────────────────────
// fees.ts — Fee extraction and charge-amount computation
// ─────────────────────────────────────────────────────────────────────────────

import type { FeeInfo, FeeBreakdown } from "./";

/**
 * Raw fee entry as returned inside a charge or orchestrator response.
 */
interface RawFee {
  type: string;
  amount: number;
}

/**
 * Parse the raw `fees` array from a Flutterwave charge response into a
 * structured FeeInfo, adding fees on top of the base amount so the customer
 * bears all transaction costs.
 *
 * @param baseAmount - The amount the merchant originally requested
 * @param rawFees    - The `fees` array from the Flutterwave charge response
 */
export function parseFees(baseAmount: number, rawFees: RawFee[]): FeeInfo {
  const breakdown: FeeBreakdown[] = (rawFees ?? []).map((f) => ({
    type: f.type,
    amount: f.amount,
  }));

  const totalFee = breakdown.reduce((sum, f) => sum + f.amount, 0);
  const chargeAmount = round2dp(baseAmount + totalFee);

  return {
    baseAmount,
    totalFee: round2dp(totalFee),
    chargeAmount,
    breakdown,
  };
}

/**
 * Format a fee summary for display in your UI.
 *
 * @example
 * formatFeeDisplay(feeInfo)
 * // → "UGX 10,000 + UGX 150 fee = UGX 10,150 total"
 */
export function formatFeeDisplay(fee: FeeInfo, currency = "UGX"): string {
  const fmt = (n: number) =>
    `${currency} ${n.toLocaleString("en-UG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  if (fee.totalFee === 0) return `${fmt(fee.chargeAmount)} (no extra fees)`;

  const lines = [`${fmt(fee.baseAmount)} + ${fmt(fee.totalFee)} fee = ${fmt(fee.chargeAmount)} total`];

  if (fee.breakdown.length > 1) {
    const details = fee.breakdown
      .filter((b) => b.amount > 0)
      .map((b) => `  • ${b.type}: ${fmt(b.amount)}`)
      .join("\n");
    if (details) lines.push(details);
  }

  return lines.join("\n");
}

function round2dp(n: number): number {
  return Math.round(n * 100) / 100;
}
