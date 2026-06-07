// tests/sdk.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlwUganda, generateTxRef, FlwUgSdkError } from "../";
import {
  SDK_CONFIG,
  CUSTOMER,
  RAW_CARD,
  RAW_CHARGE_PENDING,
  RAW_CHARGE_REQUIRES_PIN,
  RAW_CHARGE_REDIRECT,
  RAW_VERIFY_SUCCESSFUL,
  RAW_FEE_RESPONSE,
  mockFetchSequence,
  mockFetchError,
  VALID_TOKEN_RESPONSE,
} from "./helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// generateTxRef
// ─────────────────────────────────────────────────────────────────────────────

describe("generateTxRef", () => {
  it("uses FLW as default prefix", () => {
    expect(generateTxRef()).toMatch(/^FLW-/);
  });

  it("uses custom prefix", () => {
    expect(generateTxRef("LGL")).toMatch(/^LGL-/);
  });

  it("produces unique values on every call", () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateTxRef()));
    expect(refs.size).toBe(100);
  });

  it("contains only uppercase alphanumeric chars and hyphens", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTxRef("LGL")).toMatch(/^LGL-[A-Z0-9]+-[A-Z0-9]+$/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda — constructor
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda constructor", () => {
  it("throws API_ERROR when clientId is missing", () => {
    expect(
      () => new FlwUganda({ ...SDK_CONFIG, clientId: "" })
    ).toThrow(FlwUgSdkError);
  });

  it("throws API_ERROR when clientSecret is missing", () => {
    expect(
      () => new FlwUganda({ ...SDK_CONFIG, clientSecret: "" })
    ).toThrow(FlwUgSdkError);
  });

  it("defaults to sandbox environment", () => {
    const { environment, ...noEnv } = SDK_CONFIG;
    const flw = new FlwUganda(noEnv);
    // Accessing private via any — just to confirm URL selection
    expect((flw as unknown as Record<string, string>).baseUrl).toContain("sandbox");
  });

  it("uses production URL when environment is live", () => {
    const flw = new FlwUganda({ ...SDK_CONFIG, environment: "live" });
    expect((flw as unknown as Record<string, string>).baseUrl).toContain("api.flutterwave.com");
    expect((flw as unknown as Record<string, string>).baseUrl).not.toContain("sandbox");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.phone
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.phone", () => {
  const flw = new FlwUganda(SDK_CONFIG);

  it("phone.validate returns valid result for MTN number", () => {
    const r = flw.phone.validate("0772123456");
    expect(r.valid).toBe(true);
    expect(r.network).toBe("MTN");
  });

  it("phone.validate returns invalid result for bad number", () => {
    const r = flw.phone.validate("123");
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("phone.detectNetwork returns MTN", () => {
    expect(flw.phone.detectNetwork("0772000000")).toBe("MTN");
  });

  it("phone.detectNetwork returns AIRTEL", () => {
    expect(flw.phone.detectNetwork("0752000000")).toBe("AIRTEL");
  });

  it("phone.detectNetwork returns null for unknown prefix", () => {
    expect(flw.phone.detectNetwork("0712000000")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.formatFee
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.formatFee", () => {
  const flw = new FlwUganda(SDK_CONFIG);

  it("returns a human-readable string", () => {
    const fee = { baseAmount: 10_000, totalFee: 150, chargeAmount: 10_150, breakdown: [{ type: "app", amount: 150 }] };
    const display = flw.formatFee(fee);
    expect(display).toContain("10,000");
    expect(display).toContain("150");
    expect(display).toContain("10,150");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.previewFees
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.previewFees", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches fee and returns FeeInfo with chargeAmount = base + fee", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE));
    const flw = new FlwUganda(SDK_CONFIG);
    const fee = await flw.previewFees(10_000, "mobile_money");

    expect(fee.baseAmount).toBe(10_000);
    expect(fee.totalFee).toBe(RAW_FEE_RESPONSE.ravefee);
    expect(fee.chargeAmount).toBe(10_000 + RAW_FEE_RESPONSE.ravefee);
  });

  it("uses payment_type=2 for mobile_money", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.previewFees(10_000, "mobile_money");

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const apiCall = calls.find(([url]: [string]) => url.includes("/transactions/fee"));
    //@ts-ignore
    expect(apiCall[0]).toContain("payment_type=2");
  });

  it("uses payment_type=1 for card", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.previewFees(50_000, "card");

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const apiCall = calls.find(([url]: [string]) => url.includes("/transactions/fee"));
    //@ts-ignore
    expect(apiCall[0]).toContain("payment_type=1");
  });

  it("includes merchantfee in breakdown when > 0", async () => {
    const feeWithMerchant = { ...RAW_FEE_RESPONSE, merchantfee: 50 };
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, feeWithMerchant));
    const flw = new FlwUganda(SDK_CONFIG);
    const fee = await flw.previewFees(10_000);

    expect(fee.breakdown.some((b) => b.type === "merchant")).toBe(true);
    expect(fee.totalFee).toBe(RAW_FEE_RESPONSE.ravefee + 50);
  });

  it("omits merchant entry from breakdown when merchantfee is 0", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE));
    const flw = new FlwUganda(SDK_CONFIG);
    const fee = await flw.previewFees(10_000);

    expect(fee.breakdown.some((b) => b.type === "merchant")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.charge — mobile money
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.charge — mobile money", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a ChargeResult with status=pending and fees", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING)
    );
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      customer: CUSTOMER,
    });

    expect(result.status).toBe("pending");
    expect(result.chargeAmount).toBe(10_150);
    expect(result.fees.totalFee).toBe(150);
    expect(result.nextAction.type).toBe("payment_instruction");
  });

  it("auto-detects MTN network from phone prefix", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456", // MTN
      customer: CUSTOMER,
    });

    // Find the orchestrator POST call and check the payload
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.payment_method.mobile_money.network).toBe("MTN");
  });

  it("auto-detects AIRTEL network", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0752000000", // Airtel
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.payment_method.mobile_money.network).toBe("AIRTEL");
  });

  it("respects explicit network override", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      network: "AIRTEL", // explicit override
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.payment_method.mobile_money.network).toBe("AIRTEL");
  });

  it("uses provided reference if given", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      customer: CUSTOMER,
      reference: "MY-REF-001",
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.reference).toBe("MY-REF-001");
  });

  it("auto-generates reference when not provided", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.reference).toBeTruthy();
    expect(body.reference).toMatch(/^FLW-/);
  });

  it("throws INVALID_PHONE for bad phone number", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE));
    const flw = new FlwUganda(SDK_CONFIG);
    await expect(
      flw.charge({
        type: "mobile_money",
        amount: 10_000,
        phoneNumber: "123", // invalid
        customer: CUSTOMER,
      })
    ).rejects.toMatchObject({ sdkError: { code: "INVALID_PHONE" } });
  });

  it("includes callbackUrl in payload when set in config", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda({ ...SDK_CONFIG, callbackUrl: "https://myapp.ug/callback" });
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.callback_url).toBe("https://myapp.ug/callback");
  });

  it("does NOT include callback_url when not set in config", async () => {
    const { callbackUrl, ...noCallback } = { ...SDK_CONFIG, callbackUrl: undefined };
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(noCallback);
    await flw.charge({
      type: "mobile_money",
      amount: 10_000,
      phoneNumber: "0772123456",
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.callback_url).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.charge — card
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.charge — card", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns requires_pin nextAction for a PIN-protected card", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_REQUIRES_PIN)
    );
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.charge({
      type: "card",
      amount: 50_000,
      card: RAW_CARD,
      customer: CUSTOMER,
    });

    expect(result.nextAction.type).toBe("requires_pin");
  });

  it("returns redirect nextAction for 3DS cards", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_REDIRECT)
    );
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.charge({
      type: "card",
      amount: 25_000,
      card: RAW_CARD,
      customer: CUSTOMER,
    });

    expect(result.nextAction.type).toBe("redirect");
    expect(result.nextAction.redirectUrl).toBeTruthy();
  });

  it("sends encrypted card fields, not plaintext", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_REQUIRES_PIN);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "card",
      amount: 50_000,
      card: RAW_CARD,
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    const card = body.payment_method.card;

    // Must have encrypted fields, not raw values
    expect(card.encrypted_card_number).not.toBe(RAW_CARD.cardNumber);
    expect(card.encrypted_cvv).not.toBe(RAW_CARD.cvv);
    expect(card.nonce).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("throws MISSING_ENCRYPTION_KEY when encryptionKey is absent", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE));
    const { encryptionKey, ...noKey } = SDK_CONFIG;
    const flw = new FlwUganda(noKey);
    await expect(
      flw.charge({ type: "card", amount: 50_000, card: RAW_CARD, customer: CUSTOMER })
    ).rejects.toMatchObject({ sdkError: { code: "MISSING_ENCRYPTION_KEY" } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.charge — bank
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.charge — bank", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends type=ussd in payment_method", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_FEE_RESPONSE, RAW_CHARGE_REDIRECT);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.charge({
      type: "bank",
      amount: 25_000,
      accountBank: "STANBIC",
      customer: CUSTOMER,
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const chargeCall = calls.find(([url]: [string]) => url.includes("direct-charges"));
    //@ts-ignore
    const body = JSON.parse(chargeCall[1].body);
    expect(body.payment_method.type).toBe("ussd");
    expect(body.payment_method.ussd.account_bank).toBe("STANBIC");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.authorize
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.authorize", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends OTP authorization payload", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.authorize("chg_002", { type: "otp", code: "123456" });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
    //@ts-ignore
    const putCall = calls.find(([url]: [string]) => url.includes("/charges/chg_002"));
    //@ts-ignore
    const body = JSON.parse(putCall[1].body);
    //@ts-ignore
    expect(putCall[1].method).toBe("PUT");
    expect(body.authorization.type).toBe("otp");
    expect(body.authorization.otp.code).toBe("123456");
  });

  it("sends AVS authorization payload", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.authorize("chg_003", {
      type: "avs",
      address: {
        city: "Kampala", country: "UG",
        line1: "Plot 12 Kampala Road",
        postalCode: "00256", state: "Central",
      },
    });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
     //@ts-ignore
    const putCall = calls.find(([url]: [string]) => url.includes("/charges/chg_003"));
     //@ts-ignore
    const body = JSON.parse(putCall[1].body);
    expect(body.authorization.type).toBe("avs");
    expect(body.authorization.avs.address.city).toBe("Kampala");
  });

  it("sends PIN authorization with encrypted pin and nonce", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_CHARGE_PENDING);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.authorize("chg_002", { type: "pin", pin: "1234" });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
     //@ts-ignore
    const putCall = calls.find(([url]: [string]) => url.includes("/charges/chg_002"));
     //@ts-ignore
    const body = JSON.parse(putCall[1].body);
    expect(body.authorization.type).toBe("pin");
    expect(body.authorization.pin.encrypted_pin).not.toBe("1234");
    expect(body.authorization.pin.nonce).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("returns a ChargeResult from the PUT response", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_CHARGE_PENDING));
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.authorize("chg_002", { type: "otp", code: "654321" });

    expect(result.chargeId).toBe(RAW_CHARGE_PENDING.id);
    expect(result.status).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUganda.verify
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUganda.verify", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns VerificationResult for a successful charge", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_VERIFY_SUCCESSFUL));
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.verify("chg_001");

    expect(result.status).toBe("successful");
    expect(result.chargeId).toBe("chg_001");
    expect(result.amount).toBe(10_150);
    expect(result.currency).toBe("UGX");
  });

  it("passes with matching expectedAmount", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_VERIFY_SUCCESSFUL));
    const flw = new FlwUganda(SDK_CONFIG);
    await expect(
      flw.verify("chg_001", { expectedAmount: 10_150 })
    ).resolves.toBeTruthy();
  });

  it("throws VERIFICATION_FAILED when amount does not match", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_VERIFY_SUCCESSFUL));
    const flw = new FlwUganda(SDK_CONFIG);
    await expect(
      flw.verify("chg_001", { expectedAmount: 99_999 })
    ).rejects.toMatchObject({
      sdkError: {
        code: "VERIFICATION_FAILED",
        message: expect.stringContaining("Amount mismatch"),
      },
    });
  });

  it("does NOT throw when expectedAmount is not provided", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_VERIFY_SUCCESSFUL));
    const flw = new FlwUganda(SDK_CONFIG);
    const result = await flw.verify("chg_001");
    expect(result).toBeTruthy();
  });

  it("makes a GET request to /charges/:id", async () => {
    const fetchMock = mockFetchSequence(VALID_TOKEN_RESPONSE, RAW_VERIFY_SUCCESSFUL);
    vi.stubGlobal("fetch", fetchMock);
    const flw = new FlwUganda(SDK_CONFIG);
    await flw.verify("chg_001");

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls;
     //@ts-ignore
    const getCall = calls.find(([url]: [string]) => url.includes("/charges/chg_001"));
     //@ts-ignore
    expect(getCall[1].method).toBe("GET");
  });
});
