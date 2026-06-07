// tests/fees.test.ts
import { describe, it, expect } from "vitest";
import { parseFees, formatFeeDisplay } from "../";

// ─────────────────────────────────────────────────────────────────────────────
// parseFees
// ─────────────────────────────────────────────────────────────────────────────

describe("parseFees", () => {
  it("adds a single fee on top of baseAmount", () => {
    const result = parseFees(10_000, [{ type: "app", amount: 150 }]);
    expect(result.baseAmount).toBe(10_000);
    expect(result.totalFee).toBe(150);
    expect(result.chargeAmount).toBe(10_150);
  });

  it("sums multiple fees correctly", () => {
    const result = parseFees(10_000, [
      { type: "app", amount: 100 },
      { type: "vat", amount: 18 },
      { type: "merchant", amount: 50 },
    ]);
    expect(result.totalFee).toBe(168);
    expect(result.chargeAmount).toBe(10_168);
    expect(result.breakdown).toHaveLength(3);
  });

  it("returns zero fee with chargeAmount === baseAmount when fees array is empty", () => {
    const result = parseFees(5_000, []);
    expect(result.totalFee).toBe(0);
    expect(result.chargeAmount).toBe(5_000);
    expect(result.breakdown).toHaveLength(0);
  });

  it("handles null/undefined fees gracefully (coerces to empty array)", () => {
 
    //@ts-ignore
    const result = parseFees(5_000, null);
    expect(result.totalFee).toBe(0);
    expect(result.chargeAmount).toBe(5_000);
  });

  it("rounds chargeAmount to 2 decimal places", () => {
    // 0.1 + 0.2 floating point trap
    const result = parseFees(100, [{ type: "app", amount: 0.1 }, { type: "vat", amount: 0.2 }]);
    expect(result.totalFee).toBe(0.3);
    expect(result.chargeAmount).toBe(100.3);
  });

  it("preserves all fee types in breakdown", () => {
    const fees = [
      { type: "app", amount: 100 },
      { type: "stamp_duty", amount: 25 },
    ];
    const result = parseFees(10_000, fees);
    expect(result.breakdown[0].type).toBe("app");
    expect(result.breakdown[1].type).toBe("stamp_duty");
  });

  it("handles zero-value fee entries without breaking", () => {
    const result = parseFees(10_000, [{ type: "vat", amount: 0 }]);
    expect(result.totalFee).toBe(0);
    expect(result.chargeAmount).toBe(10_000);
    expect(result.breakdown).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatFeeDisplay
// ─────────────────────────────────────────────────────────────────────────────

describe("formatFeeDisplay", () => {
  it("shows base + fee = total when fee > 0", () => {
    const fee = parseFees(10_000, [{ type: "app", amount: 150 }]);
    const display = formatFeeDisplay(fee);
    // Should contain all three numbers
    expect(display).toContain("10,000");
    expect(display).toContain("150");
    expect(display).toContain("10,150");
    expect(display).toContain("UGX");
  });

  it("shows no-fee message when totalFee is 0", () => {
    const fee = parseFees(10_000, []);
    const display = formatFeeDisplay(fee);
    expect(display).toContain("no extra fees");
    expect(display).toContain("10,000");
  });

  it("includes itemised breakdown when multiple fees exist", () => {
    const fee = parseFees(10_000, [
      { type: "app", amount: 100 },
      { type: "vat", amount: 18 },
    ]);
    const display = formatFeeDisplay(fee);
    expect(display).toContain("app");
    expect(display).toContain("vat");
    expect(display).toContain("•");
  });

  it("does NOT show breakdown bullets for a single fee", () => {
    const fee = parseFees(10_000, [{ type: "app", amount: 150 }]);
    const display = formatFeeDisplay(fee);
    // Single fee — no bullet list
    expect(display).not.toContain("•");
  });

  it("respects custom currency prefix", () => {
    const fee = parseFees(100, [{ type: "app", amount: 5 }]);
    const display = formatFeeDisplay(fee, "USD");
    expect(display).toContain("USD");
    expect(display).not.toContain("UGX");
  });

  it("skips zero-amount entries from bullet list", () => {
    const fee = parseFees(10_000, [
      { type: "app", amount: 150 },
      { type: "vat", amount: 0 },
    ]);
    const display = formatFeeDisplay(fee);
    // vat is 0 — should be filtered from bullets
    expect(display).not.toMatch(/vat.*0/i);
  });
});
