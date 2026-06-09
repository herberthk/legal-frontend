// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/utils/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateUUID,
  isValidUUID,
  validateAmount,
  formatAmount,
  sanitisePhoneNumber,
  validatePhoneNumber,
  validatePaymentId,
  validateCustomerMessage,
  validateMetadata,
  defaultShouldRetry,
  withRetry,
  sleep,
  createTimeoutSignal,
  BASE_URLS,
} from "../src/utils";
import { PawaPayValidationError } from "../src/errors";

// ── generateUUID ──────────────────────────────────────────────────────────────

describe("generateUUID", () => {
  it("returns a valid UUIDv4 string", () => {
    const id = generateUUID();
    expect(isValidUUID(id)).toBe(true);
  });

  it("returns unique values on each call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUUID()));
    expect(ids.size).toBe(50);
  });

  it("falls back to Math.random polyfill when crypto.randomUUID is unavailable", () => {
    // Stub out crypto so the polyfill branch is exercised
    vi.stubGlobal("crypto", { randomUUID: undefined });
    const id = generateUUID();
    expect(isValidUUID(id)).toBe(true);
    vi.unstubAllGlobals();
  });
});

// ── isValidUUID ───────────────────────────────────────────────────────────────

describe("isValidUUID", () => {
  it("returns true for a valid UUIDv4", () => {
    expect(isValidUUID("a1b2c3d4-e5f6-4789-abcd-ef0123456789")).toBe(true);
  });

  it("returns false for UUIDv1", () => {
    expect(isValidUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("returns false for a string missing dashes", () => {
    expect(isValidUUID("a1b2c3d4e5f64789abcdef0123456789")).toBe(false);
  });

  it("returns false for a string with wrong version digit", () => {
    expect(isValidUUID("a1b2c3d4-e5f6-3789-abcd-ef0123456789")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isValidUUID("A1B2C3D4-E5F6-4789-ABCD-EF0123456789")).toBe(true);
  });
});

// ── validateAmount ────────────────────────────────────────────────────────────

describe("validateAmount", () => {
  const valid = ["1", "100", "5000", "9.5", "9.51", "9.123", "99999999999999999"];

  it.each(valid)('accepts valid amount "%s"', (amt) => {
    expect(() => validateAmount(amt)).not.toThrow();
  });

  const invalid = ["", "00", "01", "-5", "abc", "1.0", "1.000", "9.12340", "9.12345"];

  it.each(invalid)('rejects invalid amount "%s"', (amt) => {
    expect(() => validateAmount(amt)).toThrow(PawaPayValidationError);
  });

  it("throws with the correct field name when provided", () => {
    expect(() => validateAmount("abc", "payoutAmount")).toThrow(
      PawaPayValidationError
    );
    try {
      validateAmount("abc", "payoutAmount");
    } catch (e) {
      expect((e as PawaPayValidationError).field).toBe("payoutAmount");
    }
  });
});

// ── formatAmount ──────────────────────────────────────────────────────────────

describe("formatAmount", () => {
  it("formats integer amounts with 0 decimals", () => {
    expect(formatAmount(5000, 0)).toBe("5000");
  });

  it("rounds to integer correctly", () => {
    expect(formatAmount(5000.7, 0)).toBe("5001");
  });

  it("formats with 2 decimal places, trimming trailing zeros", () => {
    expect(formatAmount(9.5, 2)).toBe("9.5");
    expect(formatAmount(9.50, 2)).toBe("9.5");
    expect(formatAmount(9.99, 2)).toBe("9.99");
  });

  it("throws for zero", () => {
    expect(() => formatAmount(0)).toThrow(PawaPayValidationError);
  });

  it("throws for negative values", () => {
    expect(() => formatAmount(-100)).toThrow(PawaPayValidationError);
  });

  it("defaults to 2 decimal places", () => {
    const result = formatAmount(100);
    expect(result).toBe("100");
  });
});

// ── sanitisePhoneNumber ───────────────────────────────────────────────────────

describe("sanitisePhoneNumber", () => {
  it("strips leading +", () => {
    expect(sanitisePhoneNumber("+256700123456")).toBe("256700123456");
  });

  it("strips spaces and dashes", () => {
    expect(sanitisePhoneNumber("+256 700-123-456")).toBe("256700123456");
  });

  it("leaves digits-only string unchanged", () => {
    expect(sanitisePhoneNumber("256700123456")).toBe("256700123456");
  });

  it("strips all non-numeric characters", () => {
    expect(sanitisePhoneNumber("(256) 700.123.456")).toBe("256700123456");
  });
});

// ── validatePhoneNumber ───────────────────────────────────────────────────────

describe("validatePhoneNumber", () => {
  const valid = [
    "256700123456",   // MTN Uganda
    "256751123456",   // Airtel Uganda
    "260971234567",   // Zambia
    "2347012345678",  // Nigeria
    "12025551234",    // US
  ];

  it.each(valid)('accepts valid MSISDN "%s"', (phone) => {
    expect(() => validatePhoneNumber(phone)).not.toThrow();
  });

  const invalid = [
    "",               // empty
    "0700123456",     // leading zero (no country code)
    "123",            // too short
    "+256700123456",  // has + prefix
    "256 700 123",    // has spaces
    "abcdefghij",     // non-numeric
  ];

  it.each(invalid)('rejects invalid phone "%s"', (phone) => {
    expect(() => validatePhoneNumber(phone)).toThrow(PawaPayValidationError);
  });
});

// ── validatePaymentId ─────────────────────────────────────────────────────────

describe("validatePaymentId", () => {
  it("accepts a valid UUIDv4", () => {
    expect(() =>
      validatePaymentId("a1b2c3d4-e5f6-4789-abcd-ef0123456789", "depositId")
    ).not.toThrow();
  });

  it("throws with correct field name for invalid UUID", () => {
    try {
      validatePaymentId("not-a-uuid", "depositId");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PawaPayValidationError);
      expect((e as PawaPayValidationError).field).toBe("depositId");
      expect((e as PawaPayValidationError).message).toContain("depositId");
    }
  });
});

// ── validateCustomerMessage ───────────────────────────────────────────────────

describe("validateCustomerMessage", () => {
  const valid = ["LegalAdviser", "Test 123", "abcd", "1234567890123456789012"];

  it.each(valid)('accepts valid message "%s"', (msg) => {
    expect(() => validateCustomerMessage(msg)).not.toThrow();
  });

  const invalid = [
    "ab",             // too short (< 4)
    "12345678901234567890123", // too long (> 22)
    "hello!",         // special character
    "hi@you",         // @ character
    "",               // empty
  ];

  it.each(invalid)('rejects invalid message "%s"', (msg) => {
    expect(() => validateCustomerMessage(msg)).toThrow(PawaPayValidationError);
  });
});

// ── validateMetadata ──────────────────────────────────────────────────────────

describe("validateMetadata", () => {
  it("accepts an empty array", () => {
    expect(() => validateMetadata([])).not.toThrow();
  });

  it("accepts up to 10 items with unique keys", () => {
    const metadata = Array.from({ length: 10 }, (_, i) => ({ [`key${i}`]: "value" }));
    expect(() => validateMetadata(metadata)).not.toThrow();
  });

  it("throws when more than 10 items are provided", () => {
    const metadata = Array.from({ length: 11 }, (_, i) => ({ [`key${i}`]: "value" }));
    expect(() => validateMetadata(metadata)).toThrow(PawaPayValidationError);
    expect(() => validateMetadata(metadata)).toThrow(/maximum of 10/);
  });

  it("throws when duplicate keys exist across items", () => {
    const metadata = [{ orderId: "123" }, { orderId: "456" }];
    expect(() => validateMetadata(metadata)).toThrow(PawaPayValidationError);
    expect(() => validateMetadata(metadata)).toThrow(/Duplicate/);
  });

  it("ignores isPII key when checking for duplicates", () => {
    const metadata = [
      { phoneNumber: "256700123456", isPII: true },
      { email: "user@example.com", isPII: true },
    ];
    expect(() => validateMetadata(metadata)).not.toThrow();
  });
});

// ── defaultShouldRetry ────────────────────────────────────────────────────────

describe("defaultShouldRetry", () => {
  it("returns true for TypeError (network failure)", () => {
    expect(defaultShouldRetry(new TypeError("fetch failed"), 0)).toBe(true);
  });

  it("returns true for 500 status errors", () => {
    expect(defaultShouldRetry({ httpStatus: 500 }, 0)).toBe(true);
    expect(defaultShouldRetry({ httpStatus: 503 }, 0)).toBe(true);
  });

  it("returns false for 400 status errors", () => {
    expect(defaultShouldRetry({ httpStatus: 400 }, 0)).toBe(false);
    expect(defaultShouldRetry({ httpStatus: 401 }, 0)).toBe(false);
    expect(defaultShouldRetry({ httpStatus: 422 }, 0)).toBe(false);
  });

  it("returns false for generic Error", () => {
    expect(defaultShouldRetry(new Error("generic"), 0)).toBe(false);
  });

  it("returns false for null", () => {
    expect(defaultShouldRetry(null, 0)).toBe(false);
  });
});

// ── withRetry ─────────────────────────────────────────────────────────────────

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 0 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable errors then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new TypeError("network error");
      return "recovered";
    });

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 0 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent error"));
    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelay: 0,
      shouldRetry: () => false,
    });
    const assertion = expect(promise).rejects.toThrow("permanent error");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("always fails"));
    const promise = withRetry(fn, {
      maxRetries: 2,
      baseDelay: 0,
      shouldRetry: () => true,
    });
    const assertion = expect(promise).rejects.toThrow("always fails");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

// ── sleep ─────────────────────────────────────────────────────────────────────

describe("sleep", () => {
  it("resolves after the specified duration", async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

// ── createTimeoutSignal ───────────────────────────────────────────────────────

describe("createTimeoutSignal", () => {
  it("returns an AbortSignal", () => {
    const signal = createTimeoutSignal(5000);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("is not already aborted", () => {
    const signal = createTimeoutSignal(5000);
    expect(signal.aborted).toBe(false);
  });
});

// ── BASE_URLS ─────────────────────────────────────────────────────────────────

describe("BASE_URLS", () => {
  it("has a sandbox URL", () => {
    expect(BASE_URLS.sandbox).toBe("https://api.sandbox.pawapay.io");
  });

  it("has a production URL", () => {
    expect(BASE_URLS.production).toBe("https://api.pawapay.io");
  });
});
