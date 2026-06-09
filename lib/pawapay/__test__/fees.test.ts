// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/utils/fees.ts  +  PawaPayClient.calculateFee / .netAmount
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  calculateFee,
  netAmount,
  FEE_SCHEDULES,
} from "../src/utils/fees";
import type { FeeCountry } from "../src/utils/fees";
import { PawaPayValidationError } from "../src/errors";
import { PawaPayClient } from "../src/client";

// ── Shared fixtures ───────────────────────────────────────────────────────────

const UGA_RATE = 3; // %
const UGA_CURRENCY = "UGX";

function makeClient() {
  return new PawaPayClient({ apiToken: "test-tok" });
}

// ─────────────────────────────────────────────────────────────────────────────
// FEE_SCHEDULES – static config
// ─────────────────────────────────────────────────────────────────────────────

describe("FEE_SCHEDULES", () => {
  it("contains a UGA schedule", () => {
    expect(FEE_SCHEDULES).toHaveProperty("UGA");
  });

  it("UGA schedule has 3% fee rate", () => {
    expect(FEE_SCHEDULES.UGA.percentageFee).toBe(3);
  });

  it("UGA schedule has UGX currency", () => {
    expect(FEE_SCHEDULES.UGA.currency).toBe("UGX");
  });

  it("UGA schedule has 0 fixed fee", () => {
    expect(FEE_SCHEDULES.UGA.fixedFee).toBe(0);
  });

  it("UGA schedule has 0 decimal places", () => {
    expect(FEE_SCHEDULES.UGA.decimals).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFee – result shape
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFee – result shape", () => {
  it("returns all required fields", () => {
    const result = calculateFee(100_000, "UGA");
    expect(result).toMatchObject({
      amount: 100_000,
      fee: expect.any(Number),
      total: expect.any(Number),
      currency: UGA_CURRENCY,
      country: "UGA",
      percentageRate: UGA_RATE,
      fixedFee: 0,
      formatted: expect.any(String),
    });
  });

  it("fee + amount === total", () => {
    const { amount, fee, total } = calculateFee(150_000, "UGA");
    expect(amount + fee).toBe(total);
  });

  it("fee is a non-negative number", () => {
    const { fee } = calculateFee(1_000, "UGA");
    expect(fee).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFee – UGA arithmetic (3%)
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFee – UGA arithmetic", () => {
  const cases: Array<[number, number, number]> = [
    //  amount      fee    total
    [100_000,   3_000, 103_000],
    [150_000,   4_500, 154_500],
    [  1_000,      30,   1_030],
    [      1,       0,       1],  // rounds to 0 (< 0.5 UGX) — whole currency
    [     33,       1,      34],  // 0.99 → rounds to 1
    [  5_000,     150,   5_150],
    [ 10_000,     300,  10_300],
    [500_000,  15_000, 515_000],
  ];

  it.each(cases)(
    "calculateFee(%i) → fee=%i, total=%i",
    (amount, expectedFee, expectedTotal) => {
      const { fee, total } = calculateFee(amount, "UGA");
      expect(fee).toBe(expectedFee);
      expect(total).toBe(expectedTotal);
    }
  );

  it("percentageRate is always 3 for UGA", () => {
    expect(calculateFee(999_999, "UGA").percentageRate).toBe(3);
  });

  it("currency is always UGX for UGA", () => {
    expect(calculateFee(5_000, "UGA").currency).toBe("UGX");
  });

  it("country echo is 'UGA'", () => {
    expect(calculateFee(5_000, "UGA").country).toBe("UGA");
  });

  it("fixed fee is always 0 for UGA", () => {
    expect(calculateFee(5_000, "UGA").fixedFee).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFee – formatted string
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFee – formatted string", () => {
  it("contains the original amount", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("150,000");
  });

  it("contains the fee amount", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("4,500");
  });

  it("contains the total amount", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("154,500");
  });

  it("contains the percentage rate", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("3%");
  });

  it("contains the currency code", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("UGX");
  });

  it("contains 'total' label", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toContain("total");
  });

  it("matches full expected string for 150,000 UGX", () => {
    const { formatted } = calculateFee(150_000, "UGA");
    expect(formatted).toBe(
      "UGX 150,000 + UGX 4,500 fee (3%) = UGX 154,500 total"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFee – edge amounts
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFee – edge amounts", () => {
  it("works for the smallest valid UGX amount (1)", () => {
    const { amount, total } = calculateFee(1, "UGA");
    expect(amount).toBe(1);
    expect(total).toBeGreaterThanOrEqual(1); // fee rounds to 0, total=1
  });

  it("works for a very large amount (1,000,000,000 UGX)", () => {
    const { fee, total } = calculateFee(1_000_000_000, "UGA");
    expect(fee).toBe(30_000_000);
    expect(total).toBe(1_030_000_000);
  });

  it("is deterministic — same input always gives same result", () => {
    const r1 = calculateFee(77_777, "UGA");
    const r2 = calculateFee(77_777, "UGA");
    expect(r1).toEqual(r2);
  });

  it("fee is an integer (no sub-UGX fractions)", () => {
    // 3% of 1 = 0.03 → rounds to 0
    const { fee } = calculateFee(1, "UGA");
    expect(Number.isInteger(fee)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateFee – validation errors
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateFee – validation errors", () => {
  const invalidAmounts: Array<[unknown, string]> = [
    [0,          "zero"],
    [-1,         "negative"],
    [-100_000,   "large negative"],
    [NaN,        "NaN"],
    [Infinity,   "Infinity"],
    [-Infinity,  "-Infinity"],
  ];

  it.each(invalidAmounts)(
    "throws PawaPayValidationError for amount=%s (%s)",
    (amount) => {
      expect(() => calculateFee(amount as number, "UGA")).toThrow(
        PawaPayValidationError
      );
    }
  );

  it("error field is 'amount' for bad amount", () => {
    try {
      calculateFee(0, "UGA");
    } catch (e) {
      expect((e as PawaPayValidationError).field).toBe("amount");
    }
  });

  it("throws PawaPayValidationError for unsupported country", () => {
    expect(() =>
      calculateFee(10_000, "KEN" as FeeCountry)
    ).toThrow(PawaPayValidationError);
  });

  it("error field is 'country' for unsupported country", () => {
    try {
      calculateFee(10_000, "ZWE" as FeeCountry);
    } catch (e) {
      expect((e as PawaPayValidationError).field).toBe("country");
    }
  });

  it("error message mentions the unsupported country code", () => {
    try {
      calculateFee(10_000, "XYZ" as FeeCountry);
    } catch (e) {
      expect((e as PawaPayValidationError).message).toContain("XYZ");
    }
  });

  it("error message mentions supported countries", () => {
    try {
      calculateFee(10_000, "XYZ" as FeeCountry);
    } catch (e) {
      expect((e as PawaPayValidationError).message).toContain("UGA");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// netAmount
// ─────────────────────────────────────────────────────────────────────────────

describe("netAmount", () => {
  it("returns amount minus the 3% fee", () => {
    expect(netAmount(150_000, "UGA")).toBe(145_500);
  });

  it("net + fee === original amount", () => {
    const amount = 200_000;
    const { fee } = calculateFee(amount, "UGA");
    expect(netAmount(amount, "UGA") + fee).toBe(amount);
  });

  it("works for small amounts", () => {
    expect(netAmount(1_000, "UGA")).toBe(970);
  });

  it("is always less than or equal to the original amount", () => {
    const amounts = [500, 1_000, 50_000, 500_000];
    for (const amt of amounts) {
      expect(netAmount(amt, "UGA")).toBeLessThanOrEqual(amt);
    }
  });

  it("throws PawaPayValidationError for invalid amount", () => {
    expect(() => netAmount(0, "UGA")).toThrow(PawaPayValidationError);
    expect(() => netAmount(-500, "UGA")).toThrow(PawaPayValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PawaPayClient.calculateFee  (integration via the client)
// ─────────────────────────────────────────────────────────────────────────────

describe("PawaPayClient.calculateFee", () => {
  const client = makeClient();

  it("is a function on PawaPayClient", () => {
    expect(typeof client.calculateFee).toBe("function");
  });

  it("returns the same result as the standalone calculateFee", () => {
    const direct = calculateFee(100_000, "UGA");
    const viaClient = client.calculateFee(100_000, "UGA");
    expect(viaClient).toEqual(direct);
  });

  it("fee is 3% of amount for UGA", () => {
    const { fee } = client.calculateFee(200_000, "UGA");
    expect(fee).toBe(6_000);
  });

  it("total = amount + fee", () => {
    const { amount, fee, total } = client.calculateFee(50_000, "UGA");
    expect(amount + fee).toBe(total);
  });

  it("throws PawaPayValidationError for zero amount", () => {
    expect(() => client.calculateFee(0, "UGA")).toThrow(PawaPayValidationError);
  });

  it("throws PawaPayValidationError for unsupported country", () => {
    expect(() =>
      client.calculateFee(50_000, "ZMB" as FeeCountry)
    ).toThrow(PawaPayValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PawaPayClient.netAmount  (integration via the client)
// ─────────────────────────────────────────────────────────────────────────────

describe("PawaPayClient.netAmount", () => {
  const client = makeClient();

  it("is a function on PawaPayClient", () => {
    expect(typeof client.netAmount).toBe("function");
  });

  it("returns amount minus fee for UGA", () => {
    expect(client.netAmount(100_000, "UGA")).toBe(97_000);
  });

  it("matches standalone netAmount", () => {
    const direct = netAmount(75_000, "UGA");
    expect(client.netAmount(75_000, "UGA")).toBe(direct);
  });
});
