// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/errors/index.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  PawaPayError,
  PawaPayApiError,
  PawaPayNetworkError,
  PawaPayValidationError,
  PawaPayRetryExhaustedError,
} from "../src/errors";

// ── PawaPayError ──────────────────────────────────────────────────────────────

describe("PawaPayError", () => {
  it("is an instance of Error", () => {
    const err = new PawaPayError("something went wrong");
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    expect(new PawaPayError("x").name).toBe("PawaPayError");
  });

  it("preserves the message", () => {
    expect(new PawaPayError("test msg").message).toBe("test msg");
  });

  it("instanceof check works across class hierarchy", () => {
    const api = new PawaPayApiError(400, {
      failureCode: "INVALID_INPUT",
      failureMessage: "bad",
    });
    expect(api).toBeInstanceOf(PawaPayError);
    expect(api).toBeInstanceOf(PawaPayApiError);
  });
});

// ── PawaPayApiError ───────────────────────────────────────────────────────────

describe("PawaPayApiError", () => {
  const makeErr = (status: number, code = "INVALID_INPUT", msg = "bad input") =>
    new PawaPayApiError(status, { failureCode: code, failureMessage: msg });

  it("stores httpStatus", () => {
    expect(makeErr(422).httpStatus).toBe(422);
  });

  it("stores failureCode and failureMessage", () => {
    const err = makeErr(400, "MISSING_PARAMETER", "required field missing");
    expect(err.failureCode).toBe("MISSING_PARAMETER");
    expect(err.failureMessage).toBe("required field missing");
  });

  it("stores optional requestId", () => {
    const err = new PawaPayApiError(
      500,
      { failureCode: "UNKNOWN_ERROR", failureMessage: "oops" },
      "req-abc-123"
    );
    expect(err.requestId).toBe("req-abc-123");
  });

  it("requestId is undefined when not provided", () => {
    expect(makeErr(400).requestId).toBeUndefined();
  });

  it("formats message correctly", () => {
    const err = makeErr(422, "INVALID_INPUT", "bad");
    expect(err.message).toBe("[422] INVALID_INPUT: bad");
  });

  it("isAuthError returns true for 401", () => {
    expect(makeErr(401).isAuthError).toBe(true);
  });

  it("isAuthError returns true for 403", () => {
    expect(makeErr(403).isAuthError).toBe(true);
  });

  it("isAuthError returns false for 400", () => {
    expect(makeErr(400).isAuthError).toBe(false);
  });

  it("isRateLimitError returns true for 429", () => {
    expect(makeErr(429).isRateLimitError).toBe(true);
  });

  it("isRateLimitError returns false for 400", () => {
    expect(makeErr(400).isRateLimitError).toBe(false);
  });

  it("isServerError returns true for 500", () => {
    expect(makeErr(500).isServerError).toBe(true);
  });

  it("isServerError returns true for 503", () => {
    expect(makeErr(503).isServerError).toBe(true);
  });

  it("isServerError returns false for 400", () => {
    expect(makeErr(400).isServerError).toBe(false);
  });

  it("has the correct name", () => {
    expect(makeErr(400).name).toBe("PawaPayApiError");
  });
});

// ── PawaPayNetworkError ───────────────────────────────────────────────────────

describe("PawaPayNetworkError", () => {
  it("stores the message", () => {
    expect(new PawaPayNetworkError("timeout").message).toBe("timeout");
  });

  it("stores the cause when provided", () => {
    const cause = new TypeError("fetch failed");
    const err = new PawaPayNetworkError("network issue", cause);
    expect(err.cause).toBe(cause);
  });

  it("cause is undefined when not provided", () => {
    expect(new PawaPayNetworkError("timeout").cause).toBeUndefined();
  });

  it("has the correct name", () => {
    expect(new PawaPayNetworkError("x").name).toBe("PawaPayNetworkError");
  });

  it("is an instance of PawaPayError", () => {
    expect(new PawaPayNetworkError("x")).toBeInstanceOf(PawaPayError);
  });
});

// ── PawaPayValidationError ────────────────────────────────────────────────────

describe("PawaPayValidationError", () => {
  it("stores the field name when provided", () => {
    const err = new PawaPayValidationError("bad amount", "amount");
    expect(err.field).toBe("amount");
  });

  it("field is undefined when not provided", () => {
    expect(new PawaPayValidationError("bad").field).toBeUndefined();
  });

  it("has the correct name", () => {
    expect(new PawaPayValidationError("x").name).toBe("PawaPayValidationError");
  });

  it("is an instance of PawaPayError", () => {
    expect(new PawaPayValidationError("x")).toBeInstanceOf(PawaPayError);
  });
});

// ── PawaPayRetryExhaustedError ────────────────────────────────────────────────

describe("PawaPayRetryExhaustedError", () => {
  it("stores the attempt count", () => {
    const err = new PawaPayRetryExhaustedError(3, new TypeError("failed"));
    expect(err.attempts).toBe(3);
  });

  it("stores the last error", () => {
    const cause = new TypeError("network");
    const err = new PawaPayRetryExhaustedError(3, cause);
    expect(err.lastError).toBe(cause);
  });

  it("formats message with attempt count", () => {
    const err = new PawaPayRetryExhaustedError(5, null);
    expect(err.message).toContain("5");
  });

  it("has the correct name", () => {
    expect(new PawaPayRetryExhaustedError(1, null).name).toBe(
      "PawaPayRetryExhaustedError"
    );
  });

  it("is an instance of PawaPayError", () => {
    expect(new PawaPayRetryExhaustedError(1, null)).toBeInstanceOf(PawaPayError);
  });
});
