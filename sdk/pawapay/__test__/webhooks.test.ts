/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/utils/webhooks.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  verifyContentDigest,
  hasSignatureHeaders,
  parseDepositCallback,
  parsePayoutCallback,
  parseRefundCallback,
} from "../src/utils/webhooks";
import { PawaPayError } from "../src/errors";
import { DEPOSIT_ID, PAYOUT_ID, REFUND_ID } from "./fixtures";

// ── verifyContentDigest ───────────────────────────────────────────────────────

describe("verifyContentDigest", () => {
  /**
   * Utility to compute a real sha-256 Content-Digest for a body string,
   * so we can test the happy path without hard-coding a value.
   */
  async function computeDigestHeader(body: string): Promise<string> {
    const encoded = new TextEncoder().encode(body);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    return `sha-256=:${hashBase64}:`;
  }

  it("returns true for a correct sha-256 digest", async () => {
    const body = JSON.stringify({ depositId: DEPOSIT_ID, status: "COMPLETED" });
    const header = await computeDigestHeader(body);
    expect(await verifyContentDigest(body, header)).toBe(true);
  });

  it("returns false when the body has been tampered with", async () => {
    const original = JSON.stringify({ depositId: DEPOSIT_ID, status: "COMPLETED" });
    const header = await computeDigestHeader(original);
    const tampered = JSON.stringify({ depositId: DEPOSIT_ID, status: "FAILED" });
    expect(await verifyContentDigest(tampered, header)).toBe(false);
  });

  it("returns false for an empty digest header", async () => {
    expect(await verifyContentDigest("body", "")).toBe(false);
  });

  it("returns false for a malformed digest header (no colons)", async () => {
    expect(await verifyContentDigest("body", "sha-256=abc123")).toBe(false);
  });

  it("returns false for an unknown algorithm", async () => {
    expect(await verifyContentDigest("body", "sha-1=:abc123:")).toBe(false);
  });

  it("returns false for a digest with the wrong base64 value", async () => {
    expect(
      await verifyContentDigest("hello world", "sha-256=:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=:")
    ).toBe(false);
  });

  it("handles sha-512 algorithm format in header", async () => {
    // We just confirm it parses and tries SHA-512 (returns false for wrong hash)
    const result = await verifyContentDigest(
      "test body",
      "sha-512=:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    );
    expect(typeof result).toBe("boolean");
  });

  it("is case-sensitive for body content", async () => {
    const body = "Hello World";
    const header = await computeDigestHeader(body);
    // Different case = different digest
    expect(await verifyContentDigest("hello world", header)).toBe(false);
  });
});

// ── hasSignatureHeaders ───────────────────────────────────────────────────────

describe("hasSignatureHeaders", () => {
  it("returns true when both signature and signature-input are present (plain object)", () => {
    const headers = {
      signature: "sig1=:abc:",
      "signature-input": "sig1=()",
    };
    expect(hasSignatureHeaders(headers)).toBe(true);
  });

  it("returns false when signature is missing", () => {
    const headers = { "signature-input": "sig1=()" };
    expect(hasSignatureHeaders(headers)).toBe(false);
  });

  it("returns false when signature-input is missing", () => {
    const headers = { signature: "sig1=:abc:" };
    expect(hasSignatureHeaders(headers)).toBe(false);
  });

  it("returns false when both headers are missing", () => {
    expect(hasSignatureHeaders({})).toBe(false);
  });

  it("works with a native Headers instance", () => {
    const headers = new Headers({
      signature: "sig1=:abc:",
      "signature-input": "sig1=()",
    });
    expect(hasSignatureHeaders(headers)).toBe(true);
  });

  it("returns false with an empty Headers instance", () => {
    expect(hasSignatureHeaders(new Headers())).toBe(false);
  });

  it("handles array header values in plain object", () => {
    const headers = {
      signature: ["sig1=:abc:"],
      "signature-input": ["sig1=()"],
    };
    expect(hasSignatureHeaders(headers as any)).toBe(true);
  });
});

// ── parseDepositCallback ──────────────────────────────────────────────────────

describe("parseDepositCallback", () => {
  const validCallback = {
    depositId: DEPOSIT_ID,
    status: "ACCEPTED",
    finalStatus: "COMPLETED",
    amount: "5000",
    currency: "UGX",
  };

  it("returns the parsed callback when valid", () => {
    const result = parseDepositCallback(validCallback);
    expect(result.depositId).toBe(DEPOSIT_ID);
    expect(result.finalStatus).toBe("COMPLETED");
  });

  it("throws PawaPayError when depositId is missing", () => {
    expect(() => parseDepositCallback({ status: "ACCEPTED" })).toThrow(
      PawaPayError
    );
  });

  it("throws PawaPayError when status is missing", () => {
    expect(() => parseDepositCallback({ depositId: DEPOSIT_ID })).toThrow(
      PawaPayError
    );
  });

  it("throws PawaPayError for null input", () => {
    expect(() => parseDepositCallback(null)).toThrow(PawaPayError);
  });

  it("throws PawaPayError for string input", () => {
    expect(() => parseDepositCallback("not-an-object")).toThrow(PawaPayError);
  });

  it("throws PawaPayError for empty object", () => {
    expect(() => parseDepositCallback({})).toThrow(PawaPayError);
  });

  it("accepts a FAILED callback", () => {
    const failedCb = {
      depositId: DEPOSIT_ID,
      status: "REJECTED",
      finalStatus: "FAILED",
      failureReason: { failureCode: "INVALID_PHONE_NUMBER", failureMessage: "bad" },
    };
    const result = parseDepositCallback(failedCb);
    expect(result.finalStatus).toBe("FAILED");
  });
});

// ── parsePayoutCallback ───────────────────────────────────────────────────────

describe("parsePayoutCallback", () => {
  const validCallback = {
    payoutId: PAYOUT_ID,
    status: "ACCEPTED",
    finalStatus: "COMPLETED",
  };

  it("returns the parsed callback when valid", () => {
    const result = parsePayoutCallback(validCallback);
    expect(result.payoutId).toBe(PAYOUT_ID);
  });

  it("throws PawaPayError when payoutId is missing", () => {
    expect(() => parsePayoutCallback({ status: "ACCEPTED" })).toThrow(PawaPayError);
  });

  it("throws PawaPayError for null input", () => {
    expect(() => parsePayoutCallback(null)).toThrow(PawaPayError);
  });

  it("throws PawaPayError when status is missing", () => {
    expect(() => parsePayoutCallback({ payoutId: PAYOUT_ID })).toThrow(PawaPayError);
  });
});

// ── parseRefundCallback ───────────────────────────────────────────────────────

describe("parseRefundCallback", () => {
  const validCallback = {
    refundId: REFUND_ID,
    status: "ACCEPTED",
    finalStatus: "COMPLETED",
  };

  it("returns the parsed callback when valid", () => {
    const result = parseRefundCallback(validCallback);
    expect(result.refundId).toBe(REFUND_ID);
  });

  it("throws PawaPayError when refundId is missing", () => {
    expect(() => parseRefundCallback({ status: "ACCEPTED" })).toThrow(PawaPayError);
  });

  it("throws PawaPayError when status is missing", () => {
    expect(() => parseRefundCallback({ refundId: REFUND_ID })).toThrow(PawaPayError);
  });

  it("throws PawaPayError for null input", () => {
    expect(() => parseRefundCallback(null)).toThrow(PawaPayError);
  });

  it("throws PawaPayError for array input", () => {
    expect(() => parseRefundCallback([])).toThrow(PawaPayError);
  });
});
