// tests/normalize.test.ts
import { describe, it, expect } from "vitest";
import { normalizeChargeResponse, normalizeVerifyResponse } from "../";
import {
  RAW_CHARGE_PENDING,
  RAW_CHARGE_REQUIRES_PIN,
  RAW_CHARGE_REDIRECT,
  RAW_VERIFY_SUCCESSFUL,
} from "./helpers";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeChargeResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeChargeResponse", () => {
  it("maps id → chargeId", () => {
    const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
    expect(result.chargeId).toBe("chg_001");
  });

  it("preserves reference and status", () => {
    const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
    expect(result.reference).toBe("LGL-TEST-001");
    expect(result.status).toBe("pending");
  });

  it("always sets currency to UGX regardless of raw value", () => {
    const result = normalizeChargeResponse({ ...RAW_CHARGE_PENDING, currency: "USD" }, 10_000);
    expect(result.currency).toBe("UGX");
  });

  it("computes chargeAmount as baseAmount + fees", () => {
    const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
    // fees: [{ type: "app", amount: 150 }]
    expect(result.chargeAmount).toBe(10_150);
  });

  it("attaches full FeeInfo on result.fees", () => {
    const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
    expect(result.fees.baseAmount).toBe(10_000);
    expect(result.fees.totalFee).toBe(150);
    expect(result.fees.breakdown).toHaveLength(1);
  });

  it("preserves created_datetime as createdAt", () => {
    const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
    expect(result.createdAt).toBe("2026-01-01T10:00:00Z");
  });

  it("falls back to current ISO string when created_datetime is absent", () => {
    const { created_datetime, ...withoutDate } = RAW_CHARGE_PENDING;
    const before = Date.now();
    const result = normalizeChargeResponse(withoutDate as typeof RAW_CHARGE_PENDING, 10_000);
    const after = Date.now();
    const ts = new Date(result.createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  describe("nextAction mapping", () => {
    it("maps payment_instruction with note", () => {
      const result = normalizeChargeResponse(RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("payment_instruction");
      expect(result.nextAction.instruction).toBe("Approve on your phone.");
    });

    it("maps payment_instruction fallback when note is absent", () => {
      const raw = {
        ...RAW_CHARGE_PENDING,
        next_action: { type: "payment_instruction" as const },
      };
      const result = normalizeChargeResponse(raw as typeof RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("payment_instruction");
      expect(result.nextAction.instruction).toBeTruthy();
    });

    it("maps requires_pin with instruction", () => {
      const result = normalizeChargeResponse(RAW_CHARGE_REQUIRES_PIN, 50_000);
      expect(result.nextAction.type).toBe("requires_pin");
      expect(result.nextAction.instruction).toMatch(/PIN/i);
    });

    it("maps redirect with redirectUrl", () => {
      const result = normalizeChargeResponse(RAW_CHARGE_REDIRECT, 25_000);
      expect(result.nextAction.type).toBe("redirect");
      expect(result.nextAction.redirectUrl).toBe("https://3ds.bank.ug/auth");
    });

    it("maps requires_otp", () => {
      const raw = { ...RAW_CHARGE_PENDING, next_action: { type: "requires_otp" as const } };
      const result = normalizeChargeResponse(raw as typeof RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("requires_otp");
      expect(result.nextAction.instruction).toMatch(/OTP/i);
    });

    it("maps requires_additional_fields", () => {
      const raw = { ...RAW_CHARGE_PENDING, next_action: { type: "requires_additional_fields" as const } };
      const result = normalizeChargeResponse(raw as typeof RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("requires_additional_fields");
    });

    it("returns type: none when next_action is absent", () => {
      const { next_action, ...withoutAction } = RAW_CHARGE_PENDING;
      const result = normalizeChargeResponse(withoutAction as typeof RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("none");
    });

    it("returns type: none for unknown next_action type", () => {
      const raw = { ...RAW_CHARGE_PENDING, next_action: { type: "unknown_type" } };
      const result = normalizeChargeResponse(raw as typeof RAW_CHARGE_PENDING, 10_000);
      expect(result.nextAction.type).toBe("none");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeVerifyResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeVerifyResponse", () => {
  it("maps all fields correctly", () => {
    const result = normalizeVerifyResponse(RAW_VERIFY_SUCCESSFUL);
    expect(result).toEqual({
      chargeId: "chg_001",
      reference: "LGL-TEST-001",
      status: "successful",
      amount: 10_150,
      currency: "UGX",
      customerId: "cust_abc",
      paymentMethodId: "pm_xyz",
      updatedAt: "2026-01-01T10:05:00Z",
    });
  });

  it("maps customer_id → customerId and payment_method_id → paymentMethodId", () => {
    const result = normalizeVerifyResponse(RAW_VERIFY_SUCCESSFUL);
    expect(result.customerId).toBe("cust_abc");
    expect(result.paymentMethodId).toBe("pm_xyz");
    // Raw snake_case fields should not appear on the normalised result
    //@ts-ignore
    expect((result as Record<string, unknown>)["customer_id"]).toBeUndefined();
    //@ts-ignore
    expect((result as Record<string, unknown>)["payment_method_id"]).toBeUndefined();
  });

  it("always sets currency to UGX", () => {
    const result = normalizeVerifyResponse({ ...RAW_VERIFY_SUCCESSFUL, currency: "USD" });
    expect(result.currency).toBe("UGX");
  });

  it("falls back to current ISO string when updated_datetime is absent", () => {
    const { updated_datetime, ...withoutDate } = RAW_VERIFY_SUCCESSFUL;
    const before = Date.now();
    const result = normalizeVerifyResponse(withoutDate as typeof RAW_VERIFY_SUCCESSFUL);
    const ts = new Date(result.updatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
  });
});
