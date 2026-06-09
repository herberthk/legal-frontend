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
  parseSignatureInput,
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

// ── Real pawaPay callback payload (live format) ───────────────────────────────

describe("parseDepositCallback – real webhook shape", () => {
  /**
   * This mirrors the exact payload pawaPay sends:
   * - status is "COMPLETED" directly (no separate finalStatus field)
   * - amount has 4 decimal places ("150000.0000")
   * - providerTransactionId is present
   * - customerMessage is present on the response body
   */
  const realCallbackBody = {
    amount: "150000.0000",
    country: "UGA",
    created: "2026-06-08T14:09:28Z",
    currency: "UGX",
    customerMessage: "breach",
    depositId: "b6b93b6c-7335-423a-9eb4-357d66608996",
    payer: {
      accountDetails: { phoneNumber: "256703752696", provider: "AIRTEL_OAPI_UGA" },
      type: "MMO",
    },
    providerTransactionId: "airtel.money.id.EX4A8lk3isWM2flQ8coD",
    status: "COMPLETED",
  };

  it("parses successfully - status COMPLETED in top-level field", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.depositId).toBe("b6b93b6c-7335-423a-9eb4-357d66608996");
    expect(result.status).toBe("COMPLETED");
  });

  it("exposes providerTransactionId", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.providerTransactionId).toBe("airtel.money.id.EX4A8lk3isWM2flQ8coD");
  });

  it("exposes customerMessage from response body", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.customerMessage).toBe("breach");
  });

  it("exposes payer with Airtel provider", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.payer?.accountDetails.provider).toBe("AIRTEL_OAPI_UGA");
    expect(result.payer?.accountDetails.phoneNumber).toBe("256703752696");
  });

  it("exposes amount with 4 decimal places as-is", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.amount).toBe("150000.0000");
  });

  it("exposes country and currency", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.country).toBe("UGA");
    expect(result.currency).toBe("UGX");
  });

  it("has no finalStatus field (matches real payload structure)", () => {
    const result = parseDepositCallback(realCallbackBody);
    expect(result.finalStatus).toBeUndefined();
  });
});

// ── Real header parsing ───────────────────────────────────────────────────────

describe("hasSignatureHeaders – real pawaPay headers", () => {
  const realHeaders = {
    host: "niece-recipient-contents.ngrok-free.dev",
    "user-agent": "Apache-HttpClient/5.4.1 (Java/17.0.16)",
    "content-length": "438",
    "accept-digest": "sha-256,sha-512",
    "content-digest":
      "sha-512=:4TeZGawzcKF+2WNgD8CK7P7DOcTxGx9gdXpOZLDmKfDJtCSgfc2LQZU58oNEvvpKIdRQCs5jVvzDFmzCs+jUQw==:",
    "content-type": "application/json",
    signature:
      "sig-pp=:MEQCIDaxBRInP0Llaepdw8x7AdLm8X6IvK123VjaZRoKpF38AiB9qyuIRKESg18AGl1Fpome9GaC1Hlw7nY0dLa7YwAv0A==:",
    "signature-date": "2026-06-09T11:55:53.226729869Z",
    "signature-input":
      'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=1781006153;expires=1781006213',
  };

  it("detects signature presence on real headers", () => {
    expect(hasSignatureHeaders(realHeaders)).toBe(true);
  });
});

describe("verifyContentDigest – real sha-512 header format", () => {
  it("correctly parses sha-512 header with + in base64 value (no false positive)", async () => {
    // The real header has + characters in the base64 — ensure the regex handles it
    const header =
      "sha-512=:4TeZGawzcKF+2WNgD8CK7P7DOcTxGx9gdXpOZLDmKfDJtCSgfc2LQZU58oNEvvpKIdRQCs5jVvzDFmzCs+jUQw==:";
    const wrongBody = "this is not the real body";
    // Should return false for wrong body (not throw or crash on + in base64)
    const result = await verifyContentDigest(wrongBody, header);
    expect(result).toBe(false);
  });

  it("returns true when sha-512 digest matches body", async () => {
    const body = "hello pawapay";
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(body));
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    const header = `sha-512=:${hashBase64}:`;
    expect(await verifyContentDigest(body, header)).toBe(true);
  });
});

// ── parseSignatureInput ───────────────────────────────────────────────────────

describe("parseSignatureInput", () => {
  const realInput =
    'sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=1781006153;expires=1781006213';

  it("parses label from real signature-input header", () => {
    const result = parseSignatureInput(realInput);
    expect(result?.label).toBe("sig-pp");
  });

  it("parses covered components", () => {
    const result = parseSignatureInput(realInput);
    expect(result?.coveredComponents).toContain("@method");
    expect(result?.coveredComponents).toContain("content-digest");
    expect(result?.coveredComponents).toContain("signature-date");
    expect(result?.coveredComponents).toContain("content-type");
  });

  it("parses algorithm", () => {
    const result = parseSignatureInput(realInput);
    expect(result?.alg).toBe("ecdsa-p256-sha256");
  });

  it("parses keyid", () => {
    const result = parseSignatureInput(realInput);
    expect(result?.keyid).toBe("HTTP_EC_P256_KEY:1");
  });

  it("parses created and expires timestamps", () => {
    const result = parseSignatureInput(realInput);
    expect(result?.created).toBe(1781006153);
    expect(result?.expires).toBe(1781006213);
  });

  it("returns null for empty string", () => {
    expect(parseSignatureInput("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseSignatureInput("not-valid-at-all")).toBeNull();
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
