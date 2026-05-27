// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Error Handler Tests
// ─────────────────────────────────────────────

import {
  handleSsentezoError,
  publicMessage,
  withSsentezo,
  type SsentezoErrorResult,
} from "../error-handler";

import {
  SsentezoAuthError,
  SsentezoError,
  SsentezoNetworkError,
  SsentezoRateLimitError,
  SsentezoTimeoutError,
  SsentezoValidationError,
} from "../errors";

// ── handleSsentezoError ───────────────────────────────────────────────────────

describe("handleSsentezoError()", () => {
  it('classifies SsentezoValidationError as kind "validation"', () => {
    const err = new SsentezoValidationError("Amount too low", { amount: ["min 500"] });
    const result = handleSsentezoError(err);

    expect(result.kind).toBe("validation");
    expect(result.httpStatus).toBe(422);
    expect(result.message).toBe("Amount too low");
    if (result.kind === "validation") {
      expect(result.fieldErrors?.amount?.[0]).toBe("min 500");
    }
  });

  it('classifies SsentezoAuthError (401) as kind "auth"', () => {
    const result = handleSsentezoError(new SsentezoAuthError(401));
    expect(result.kind).toBe("auth");
    expect(result.httpStatus).toBe(401);
    if (result.kind === "auth") {
      expect(result.publicMessage).toBe("Service configuration error.");
    }
  });

  it('classifies SsentezoAuthError (403) as kind "auth" with httpStatus 403', () => {
    const result = handleSsentezoError(new SsentezoAuthError(403));
    expect(result.kind).toBe("auth");
    expect(result.httpStatus).toBe(403);
  });

  it('classifies SsentezoRateLimitError as kind "rateLimit"', () => {
    const result = handleSsentezoError(new SsentezoRateLimitError());
    expect(result.kind).toBe("rateLimit");
    expect(result.httpStatus).toBe(429);
    if (result.kind === "rateLimit") {
      expect(result.publicMessage).toMatch(/too many requests/i);
    }
  });

  it('classifies SsentezoTimeoutError as kind "timeout"', () => {
    const result = handleSsentezoError(new SsentezoTimeoutError(15_000));
    expect(result.kind).toBe("timeout");
    expect(result.httpStatus).toBe(504);
    if (result.kind === "timeout") {
      expect(result.timeoutMs).toBe(15_000);
      expect(result.publicMessage).toMatch(/timed out/i);
    }
  });

  it('classifies SsentezoNetworkError as kind "network"', () => {
    const result = handleSsentezoError(new SsentezoNetworkError("ECONNREFUSED"));
    expect(result.kind).toBe("network");
    expect(result.httpStatus).toBe(503);
    if (result.kind === "network") {
      expect(result.publicMessage).toMatch(/could not reach/i);
    }
  });

  it('classifies a generic SsentezoError as kind "api"', () => {
    const err = new SsentezoError("UPPER_CEILING_BREACH", "UPPER_CEILING_BREACH", 400);
    const result = handleSsentezoError(err);
    expect(result.kind).toBe("api");
    expect(result.httpStatus).toBe(400);
    if (result.kind === "api") {
      expect(result.code).toBe("UPPER_CEILING_BREACH");
    }
  });

  it('classifies a plain Error as kind "unknown"', () => {
    const result = handleSsentezoError(new Error("oops"));
    expect(result.kind).toBe("unknown");
    expect(result.httpStatus).toBe(500);
    if (result.kind === "unknown") {
      expect(result.cause).toBeInstanceOf(Error);
    }
  });

  it('classifies a thrown string as kind "unknown"', () => {
    const result = handleSsentezoError("something went wrong");
    expect(result.kind).toBe("unknown");
  });

  it('classifies null as kind "unknown"', () => {
    const result = handleSsentezoError(null);
    expect(result.kind).toBe("unknown");
  });
});

// ── publicMessage ─────────────────────────────────────────────────────────────

describe("publicMessage()", () => {
  const cases: Array<[string, SsentezoErrorResult, string | RegExp]> = [
    [
      "returns full message for validation",
      handleSsentezoError(new SsentezoValidationError("Amount too low")),
      "Amount too low",
    ],
    [
      "returns api message for generic API errors",
      handleSsentezoError(new SsentezoError("Custom API message", "SOME_CODE", 400)),
      "Custom API message",
    ],
    [
      "returns safe public message for auth errors",
      handleSsentezoError(new SsentezoAuthError(401)),
      "Service configuration error.",
    ],
    [
      "returns safe public message for rate limit",
      handleSsentezoError(new SsentezoRateLimitError()),
      /too many requests/i,
    ],
    [
      "returns safe public message for timeout",
      handleSsentezoError(new SsentezoTimeoutError(30_000)),
      /timed out/i,
    ],
    [
      "returns safe public message for network errors",
      handleSsentezoError(new SsentezoNetworkError("ECONNREFUSED")),
      /could not reach/i,
    ],
    [
      "returns generic message for unknown errors",
      handleSsentezoError("unexpected string"),
      /unexpected/i,
    ],
  ];

  test.each(cases)("%s", (_label, result, expected) => {
    const msg = publicMessage(result);
    if (expected instanceof RegExp) {
      expect(msg).toMatch(expected);
    } else {
      expect(msg).toBe(expected);
    }
  });
});

// ── withSsentezo ──────────────────────────────────────────────────────────────

describe("withSsentezo()", () => {
  it("returns { success: true, data } when the fn resolves", async () => {
    const result = await withSsentezo(async () => ({ amount: 5_000 }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5_000);
    }
  });

  it("returns { success: false } when fn throws a SsentezoValidationError", async () => {
    const result = await withSsentezo(async () => {
      throw new SsentezoValidationError("Bad MSISDN", { msisdn: ["invalid format"] });
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("validation");
      expect(result.error).toBe("Bad MSISDN");
      expect(result.fieldErrors?.msisdn?.[0]).toBe("invalid format");
    }
  });

  it("returns { success: false } with safe public message for auth errors", async () => {
    const result = await withSsentezo(async () => {
      throw new SsentezoAuthError(403);
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("auth");
      expect(result.error).toBe("Service configuration error.");
    }
  });

  it("returns { success: false } for rate limit errors", async () => {
    const result = await withSsentezo(async () => {
      throw new SsentezoRateLimitError();
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("rateLimit");
      expect(result.error).toMatch(/too many requests/i);
    }
  });

  it("returns { success: false } for network errors", async () => {
    const result = await withSsentezo(async () => {
      throw new SsentezoNetworkError("ECONNREFUSED");
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("network");
    }
  });

  it("returns { success: false } for unexpected errors without leaking internals", async () => {
    const result = await withSsentezo(async () => {
      throw new Error("DB connection pool exhausted — secret internal detail");
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("unknown");
      // The raw internal message must NOT reach the client
      expect(result.error).not.toMatch(/pool exhausted/i);
      expect(result.error).toMatch(/unexpected/i);
    }
  });

  it("preserves the generic type parameter on success", async () => {
    type Payload = { id: string; amount: number };
    const result = await withSsentezo<Payload>(async () => ({ id: "abc", amount: 1_000 }));

    expect(result.success).toBe(true);
    if (result.success) {
      // TypeScript narrows result.data to Payload here — compile-time check
      const _id: string   = result.data.id;
      const _amt: number  = result.data.amount;
      expect(_id).toBe("abc");
      expect(_amt).toBe(1_000);
    }
  });

  it("sets code when kind is api", async () => {
    const result = await withSsentezo(async () => {
      throw new SsentezoError("ceiling breach", "UPPER_CEILING_BREACH", 400);
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.kind).toBe("api");
      expect(result.code).toBe("UPPER_CEILING_BREACH");
    }
  });
});
