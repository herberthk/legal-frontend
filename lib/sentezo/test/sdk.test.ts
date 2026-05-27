// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Test Suite
//  Run with: npm test
//
//  Tests use global fetch mocking (no external HTTP calls).
// ─────────────────────────────────────────────

// ── Jest config (inline — no separate jest.config.js needed for Next.js) ──────
// Add to package.json "jest" key:
// {
//   "jest": {
//     "preset": "ts-jest",
//     "testEnvironment": "node",
//     "extensionsToTreatAsEsm": [".ts"],
//     "moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }
//   }
// }

import {
  SsentezoWallet,
  SsentezoAuthError,
  SsentezoRateLimitError,
  SsentezoValidationError,
  SsentezoTimeoutError,
  generateReference,
  generatePrefixedReference,
  parseCallbackPayload,
  isSsentezoValidationError,
  isSsentezoError,
} from "../";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

type MockBody = Record<string, unknown>;

/** Replace global fetch with a mock that returns the given body and status. */
function mockFetch(body: MockBody, status = 202): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => body,
  } as Response);
}

/** Make every fetch call reject with a network error. */
function mockFetchNetworkError(): void {
  global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
}

/** Build a wallet configured against sandbox with fake credentials. */
function makeWallet(): SsentezoWallet {
  return new SsentezoWallet({
    apiUser:     "test_user",
    apiKey:      "test_key",
    environment: "sandbox",
    maxRetries:  0, // disable retries in tests so they run fast
    timeout:     5_000,
  });
}

// ─────────────────────────────────────────────
//  SsentezoWallet — Instantiation
// ─────────────────────────────────────────────

describe("SsentezoWallet — instantiation", () => {
  const original = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, original);
  });

  it("throws when no credentials are provided", () => {
    delete process.env.SSENTEZO_API_USER;
    delete process.env.SSENTEZO_API_KEY;

    expect(() => new SsentezoWallet()).toThrow(/Missing credentials/);
  });

  it("reads credentials from environment variables", () => {
    process.env.SSENTEZO_API_USER = "env_user";
    process.env.SSENTEZO_API_KEY  = "env_key";

    expect(() => new SsentezoWallet()).not.toThrow();
  });

  it("prefers constructor config over env vars", () => {
    process.env.SSENTEZO_API_USER = "env_user";
    process.env.SSENTEZO_API_KEY  = "env_key";

    expect(() =>
      new SsentezoWallet({ apiUser: "config_user", apiKey: "config_key" })
    ).not.toThrow();
  });

  it("exposes all four resource namespaces", () => {
    const wallet = makeWallet();
    expect(wallet.balance).toBeDefined();
    expect(wallet.msisdn).toBeDefined();
    expect(wallet.transactions).toBeDefined();
    expect(wallet.bankTransfer).toBeDefined();
  });
});

// ─────────────────────────────────────────────
//  wallet.balance
// ─────────────────────────────────────────────

describe("wallet.balance.check()", () => {
  it("returns balance data on success", async () => {
    mockFetch({
      response: "OK",
      data: { amount: 100_000, formatted: "100,000", currency: "UGX" },
    });

    const wallet  = makeWallet();
    const balance = await wallet.balance.check();

    expect(balance.amount).toBe(100_000);
    expect(balance.formatted).toBe("100,000");
    expect(balance.currency).toBe("UGX");
  });

  it("sends currency: UGX in the request body", async () => {
    mockFetch({ response: "OK", data: { amount: 0, formatted: "0", currency: "UGX" } });

    const wallet = makeWallet();
    await wallet.balance.check();

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as MockBody;
    expect(body.currency).toBe("UGX");
  });
});

// ─────────────────────────────────────────────
//  wallet.msisdn
// ─────────────────────────────────────────────

describe("wallet.msisdn.verify()", () => {
  it("returns name data for a valid MSISDN", async () => {
    mockFetch({
      response: "OK",
      data: { msisdn: "256709920188", FirstName: "John", Surname: "Doe" },
    });

    const wallet = makeWallet();
    const info   = await wallet.msisdn.verify("256709920188");

    expect(info.FirstName).toBe("John");
    expect(info.Surname).toBe("Doe");
  });

  it("throws SsentezoValidationError for a malformed MSISDN (client-side)", async () => {
    const wallet = makeWallet();

    await expect(wallet.msisdn.verify("0709920188")).rejects.toMatchObject({
      name: "SsentezoValidationError",
    });

    // No HTTP call should have been made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws SsentezoValidationError for a non-Ugandan prefix", async () => {
    const wallet = makeWallet();
    await expect(wallet.msisdn.verify("254709920188")).rejects.toThrow(
      SsentezoValidationError
    );
  });
});

// ─────────────────────────────────────────────
//  wallet.transactions
// ─────────────────────────────────────────────

describe("wallet.transactions.deposit()", () => {
  const validParams = {
    externalReference: generateReference(),
    msisdn:            "256709920188",
    amount:            5_000,
    reason:            "Test payment",
  };

  it("returns a PENDING result on success", async () => {
    mockFetch({
      response: "OK",
      data: {
        transactionStatus:      "PENDING",
        ssentezoWalletReference: "wallet-ref-abc",
        financialTransactionId:  "fin-id-xyz",
      },
    });

    const wallet = makeWallet();
    const result = await wallet.transactions.deposit(validParams);

    expect(result.transactionStatus).toBe("PENDING");
    expect(result.ssentezoWalletReference).toBe("wallet-ref-abc");
  });

  it("sends successCallback and failureCallback when provided", async () => {
    mockFetch({ response: "OK", data: { transactionStatus: "PENDING", ssentezoWalletReference: "x", financialTransactionId: "y" } });

    const wallet = makeWallet();
    await wallet.transactions.deposit({
      ...validParams,
      successCallback: "https://example.com/success",
      failureCallback: "https://example.com/failure",
    });

    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string
    ) as MockBody;

    expect(body.success_callback).toBe("https://example.com/success");
    expect(body.failure_callback).toBe("https://example.com/failure");
  });

  // ── Amount validation ──────────────────────────────────────────────────────

  it("rejects amount below 500 (client-side)", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({ ...validParams, amount: 499 })
    ).rejects.toThrow(SsentezoValidationError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects amount above 7,000,000 (client-side)", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({ ...validParams, amount: 7_000_001 })
    ).rejects.toThrow(SsentezoValidationError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a decimal amount", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({ ...validParams, amount: 1500.5 })
    ).rejects.toThrow(/whole number/);
  });

  it("rejects a NaN amount", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({ ...validParams, amount: NaN })
    ).rejects.toThrow(SsentezoValidationError);
  });

  // ── Reference validation ───────────────────────────────────────────────────

  it("rejects an empty externalReference", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({ ...validParams, externalReference: "" })
    ).rejects.toThrow(SsentezoValidationError);
  });

  it("rejects an externalReference over 250 chars", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({
        ...validParams,
        externalReference: "a".repeat(251),
      })
    ).rejects.toThrow(/250 characters/);
  });

  // ── Callback URL validation ────────────────────────────────────────────────

  it("rejects an invalid successCallback URL", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({
        ...validParams,
        successCallback: "not-a-url",
      })
    ).rejects.toThrow(SsentezoValidationError);
  });

  it("rejects a non-HTTP callback URL", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.transactions.deposit({
        ...validParams,
        successCallback: "ftp://example.com/cb",
      })
    ).rejects.toThrow(/HTTP or HTTPS/);
  });
});

// ─────────────────────────────────────────────

describe("wallet.transactions.withdraw()", () => {
  it("calls the /withdraw endpoint", async () => {
    mockFetch({
      response: "OK",
      data: { transactionStatus: "PENDING", ssentezoWalletReference: "w1", financialTransactionId: "f1" },
    });

    const wallet = makeWallet();
    await wallet.transactions.withdraw({
      externalReference: generateReference(),
      msisdn:            "256709920188",
      amount:            10_000,
      reason:            "Payout",
    });

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/withdraw");
  });
});

// ─────────────────────────────────────────────

describe("wallet.transactions.getStatus()", () => {
  it("returns full status data", async () => {
    mockFetch({
      response: "OK",
      data: {
        transactionStatus:      "SUCCEEDED",
        ssentezoWalletReference: "w1",
        externalReference:       "my-ref",
        financialTransactionId:  "f1",
        amount:                  5_000,
        reason:                  "Test",
        currency:                "UGX",
        msisdn:                  "256709920188",
        transactionTime:         "2024-04-24T16:24:58.000000Z",
      },
    });

    const wallet = makeWallet();
    const status = await wallet.transactions.getStatus("my-ref");

    expect(status.transactionStatus).toBe("SUCCEEDED");
    expect(status.amount).toBe(5_000);
  });

  it("URL-encodes the externalReference in the path", async () => {
    mockFetch({ response: "OK", data: { transactionStatus: "SUCCEEDED", ssentezoWalletReference: "x", externalReference: "order 1", financialTransactionId: "y", amount: 5000, reason: "t", currency: "UGX", msisdn: "256709920188", transactionTime: "" } });

    const wallet = makeWallet();
    await wallet.transactions.getStatus("order 1");

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("order%201");
  });
});

// ─────────────────────────────────────────────
//  wallet.bankTransfer
// ─────────────────────────────────────────────

describe("wallet.bankTransfer.getBanks()", () => {
  const banksResponse = {
    response: "OK",
    data: {
      banks: [
        { id: 3, bank_name: "Equity",       address: "Church House", swift_code: "QW2456" },
        { id: 4, bank_name: "Stanbic Bank", address: "Church House", swift_code: "QW2456" },
      ],
    },
  };

  it("returns the bank list", async () => {
    mockFetch(banksResponse);
    const wallet = makeWallet();
    const banks  = await wallet.bankTransfer.getBanks();

    expect(banks).toHaveLength(2);
    expect(banks[0]?.bank_name).toBe("Equity");
  });

  it("caches the bank list", async () => {
    mockFetch(banksResponse);
    const wallet = makeWallet();

    await wallet.bankTransfer.getBanks();
    await wallet.bankTransfer.getBanks();
    await wallet.bankTransfer.getBanks();

    // Only one HTTP call despite three invocations
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when { fresh: true }", async () => {
    mockFetch(banksResponse);
    const wallet = makeWallet();

    await wallet.bankTransfer.getBanks();
    await wallet.bankTransfer.getBanks({ fresh: true });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("clears the cache with clearBankCache()", async () => {
    mockFetch(banksResponse);
    const wallet = makeWallet();

    await wallet.bankTransfer.getBanks();
    wallet.bankTransfer.clearBankCache();
    await wallet.bankTransfer.getBanks();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("wallet.bankTransfer.requestTransfer()", () => {
  const validParams = {
    externalReference: generateReference(),
    bankId:            4,
    accountName:       "John Doe",
    accountNumber:     "044653389534563",
    amount:            75_000,
    reason:            "Supplier payment",
  };

  it("initiates a transfer and returns PENDING", async () => {
    mockFetch({
      response: "OK",
      data: {
        transactionStatus:      "PENDING",
        ssentezoWalletReference: "bt-wallet-ref",
        externalReference:       validParams.externalReference,
      },
    });

    const wallet = makeWallet();
    const result = await wallet.bankTransfer.requestTransfer(validParams);

    expect(result.transactionStatus).toBe("PENDING");
  });

  it("sends amount as a string in the body", async () => {
    mockFetch({ response: "OK", data: { transactionStatus: "PENDING", ssentezoWalletReference: "x", externalReference: "y" } });

    const wallet = makeWallet();
    await wallet.bankTransfer.requestTransfer(validParams);

    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string
    ) as MockBody;

    expect(typeof body.amount).toBe("string");
    expect(body.amount).toBe("75000");
  });

  it("rejects amount below 50,000 (client-side)", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.bankTransfer.requestTransfer({ ...validParams, amount: 49_999 })
    ).rejects.toThrow(/50,000/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid bankId", async () => {
    const wallet = makeWallet();
    await expect(
      wallet.bankTransfer.requestTransfer({ ...validParams, bankId: 0 })
    ).rejects.toThrow(SsentezoValidationError);
  });
});

// ─────────────────────────────────────────────
//  Error handling (HTTP error codes)
// ─────────────────────────────────────────────

describe("HTTP error handling", () => {
  it("throws SsentezoAuthError on HTTP 401", async () => {
    mockFetch({ response: "ERROR", error: { message: "Unauthorized" } }, 401);
    const wallet = makeWallet();
    await expect(wallet.balance.check()).rejects.toThrow(SsentezoAuthError);
  });

  it("throws SsentezoAuthError on HTTP 403", async () => {
    mockFetch({ response: "ERROR", error: { message: "Forbidden" } }, 403);
    const wallet = makeWallet();
    await expect(wallet.balance.check()).rejects.toThrow(SsentezoAuthError);
  });

  it("throws SsentezoRateLimitError on HTTP 429 (maxRetries=0)", async () => {
    mockFetch({ response: "ERROR", error: { message: "Rate limit", code: "RATE_LIMIT_EXCEEDED" } }, 429);
    const wallet = makeWallet();
    await expect(wallet.balance.check()).rejects.toThrow(SsentezoRateLimitError);
  });

  it("throws SsentezoValidationError on HTTP 422 with field errors", async () => {
    mockFetch(
      {
        response: "ERROR",
        error: {
          message: "Validation failed",
          errors:  { amount: ["must be at least 500"] },
        },
      },
      422
    );

    const wallet = makeWallet();
    try {
      await wallet.balance.check(); // force an API call
      fail("Expected to throw");
    } catch (err) {
      expect(isSsentezoValidationError(err)).toBe(true);
      if (isSsentezoValidationError(err)) {
        expect(err.fieldErrors?.amount?.[0]).toBe("must be at least 500");
      }
    }
  });

  it("retries on network error and eventually throws SsentezoNetworkError", async () => {
    // Allow retries for this one test
    const wallet = new SsentezoWallet({
      apiUser: "u", apiKey: "k", environment: "sandbox", maxRetries: 2, timeout: 5_000,
    });
    mockFetchNetworkError();
    await expect(wallet.balance.check()).rejects.toMatchObject({
      name: "SsentezoNetworkError",
    });
    // 1 initial + 2 retries = 3 total calls
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

// ─────────────────────────────────────────────
//  Timeout
// ─────────────────────────────────────────────

describe("SsentezoTimeoutError", () => {
  it("throws SsentezoTimeoutError when fetch is aborted", async () => {
    // Simulate AbortError
    global.fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
    );

    const wallet = new SsentezoWallet({
      apiUser: "u", apiKey: "k", environment: "sandbox", maxRetries: 0, timeout: 100,
    });

    await expect(wallet.balance.check()).rejects.toThrow(SsentezoTimeoutError);
  });
});

// ─────────────────────────────────────────────
//  Type guards
// ─────────────────────────────────────────────

describe("type guards", () => {
  it("isSsentezoError returns true for any SDK error", () => {
    expect(isSsentezoError(new SsentezoAuthError(401))).toBe(true);
    expect(isSsentezoError(new SsentezoValidationError("bad"))).toBe(true);
    expect(isSsentezoError(new Error("plain"))).toBe(false);
    expect(isSsentezoError("string")).toBe(false);
    expect(isSsentezoError(null)).toBe(false);
  });

  it("isSsentezoValidationError narrows correctly", () => {
    const e = new SsentezoValidationError("bad", { field: ["err"] });
    expect(isSsentezoValidationError(e)).toBe(true);
    expect(isSsentezoValidationError(new SsentezoAuthError(401))).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────

describe("generateReference()", () => {
  it("returns a valid UUID v4", () => {
    const ref = generateReference();
    expect(ref).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns unique values", () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateReference()));
    expect(refs.size).toBe(100);
  });
});

describe("generatePrefixedReference()", () => {
  it("prepends the prefix", () => {
    const ref = generatePrefixedReference("order_1234");
    expect(ref.startsWith("order_1234_")).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  parseCallbackPayload()
// ─────────────────────────────────────────────

describe("parseCallbackPayload()", () => {
  const validPayload = {
    response: "OK",
    data: {
      transactionStatus:      "SUCCEEDED",
      ssentezoWalletReference: "wallet-ref",
      externalReference:       "order_abc",
      financialTransactionId:  "fin-id",
    },
  };

  it("parses a valid SUCCEEDED payload", () => {
    const result = parseCallbackPayload(validPayload);
    expect(result?.transactionStatus).toBe("SUCCEEDED");
    expect(result?.externalReference).toBe("order_abc");
  });

  it("parses a valid FAILED payload", () => {
    const result = parseCallbackPayload({
      ...validPayload,
      data: { ...validPayload.data, transactionStatus: "FAILED" },
    });
    expect(result?.transactionStatus).toBe("FAILED");
  });

  it("returns null for a non-OK response", () => {
    expect(parseCallbackPayload({ response: "ERROR", error: { message: "x" } })).toBeNull();
  });

  it("returns null for a missing data field", () => {
    expect(parseCallbackPayload({ response: "OK" })).toBeNull();
  });

  it("returns null for an invalid transactionStatus", () => {
    expect(
      parseCallbackPayload({
        ...validPayload,
        data: { ...validPayload.data, transactionStatus: "UNKNOWN" },
      })
    ).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseCallbackPayload(null)).toBeNull();
  });

  it("returns null for a string input", () => {
    expect(parseCallbackPayload("not an object")).toBeNull();
  });
});
