/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: toolkit · finances · payment-page resources
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { ToolkitResource } from "../src/resources/toolkit";
import { FinancesResource } from "../src/resources/finances.js";
import { PaymentPageResource } from "../src/resources/payment-page";
import { HttpClient } from "../src/http-client.js";
import { PawaPayValidationError } from "../src/errors";
import { isValidUUID } from "../src/utils/index.js";
import { mockFetch, STATEMENT_ID, DEPOSIT_ID } from "./fixtures";
import { OperationType } from "../src/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHttp(fetchImpl: typeof fetch) {
  return new HttpClient({
    apiToken: "tok",
    fetchImpl: fetchImpl as any,
    maxRetries: 0,
    retryDelay: 0,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOLKIT
// ═════════════════════════════════════════════════════════════════════════════

describe("ToolkitResource.predictProvider", () => {
  const successResp = {
    country: "UGA",
    provider: "MTN_MOMO_UGA",
    phoneNumber: "256700123456",
  };

  it("calls POST /v2/predict-provider", async () => {
    const fetch = mockFetch(successResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.predictProvider({ phoneNumber: "256700123456" });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/predict-provider");
    expect(init.method).toBe("POST");
  });

  it("sends phoneNumber in the request body", async () => {
    const fetch = mockFetch(successResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.predictProvider({ phoneNumber: "256700123456" });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.phoneNumber).toBe("256700123456");
  });

  it("returns provider prediction", async () => {
    const resource = new ToolkitResource(makeHttp(mockFetch(successResp) as any));
    const result = await resource.predictProvider({ phoneNumber: "256700123456" });
    expect(result.provider).toBe("MTN_MOMO_UGA");
    expect(result.country).toBe("UGA");
    expect(result.phoneNumber).toBe("256700123456");
  });

  it("works with Airtel number", async () => {
    const resp = { country: "UGA", provider: "AIRTEL_OAPI_UGA", phoneNumber: "256751123456" };
    const resource = new ToolkitResource(makeHttp(mockFetch(resp) as any));
    const result = await resource.predictProvider({ phoneNumber: "256751123456" });
    expect(result.provider).toBe("AIRTEL_OAPI_UGA");
  });
});

describe("ToolkitResource.getActiveConfiguration", () => {
  const configResp = {
    companyName: "LegalAdviser",
    signatureConfiguration: { signedRequestsOnly: false, signedCallbacks: true },
    countries: [
      {
        country: "UGA",
        displayName: { en: "Uganda" },
        prefix: "256",
        flag: "🇺🇬",
        providers: [],
      },
    ],
  };

  it("calls GET /v2/active-conf", async () => {
    const fetch = mockFetch(configResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getActiveConfiguration();
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/active-conf");
    expect(init.method).toBe("GET");
  });

  it("appends country filter as query param", async () => {
    const fetch = mockFetch(configResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getActiveConfiguration({ country: "UGA" });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain("country=UGA");
  });

  it("appends operationType filter as query param", async () => {
    const fetch = mockFetch(configResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getActiveConfiguration({ operationType: OperationType.DEPOSIT });
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain("operationType=DEPOSIT");
  });

  it("omits undefined filters from URL", async () => {
    const fetch = mockFetch(configResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getActiveConfiguration({});
    const [url] = (fetch as any).mock.calls[0];
    expect(url).not.toContain("country=");
    expect(url).not.toContain("operationType=");
  });

  it("returns configuration data", async () => {
    const resource = new ToolkitResource(makeHttp(mockFetch(configResp) as any));
    const result = await resource.getActiveConfiguration();
    expect(result.companyName).toBe("LegalAdviser");
    expect(result.countries).toHaveLength(1);
    expect(result.countries[0]?.country).toBe("UGA");
  });
});

describe("ToolkitResource.getProviderAvailability", () => {
  const availResp = [
    {
      providerId: "MTN_MOMO_UGA",
      country: "UGA",
      operationTypes: [{ operationType: "DEPOSIT", status: "OPERATIONAL" }],
    },
  ];

  it("calls GET /v2/availability", async () => {
    const fetch = mockFetch(availResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getProviderAvailability();
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/availability");
  });

  it("returns array of availability objects", async () => {
    const resource = new ToolkitResource(makeHttp(mockFetch(availResp) as any));
    const result = await resource.getProviderAvailability();
    expect(result).toHaveLength(1);
    expect(result[0]?.providerId).toBe("MTN_MOMO_UGA");
  });
});

describe("ToolkitResource.getPublicKeys", () => {
  const keysResp = {
    keys: [{ kid: "key-1", kty: "RSA", use: "sig", alg: "RS256", n: "abc", e: "AQAB" }],
  };

  it("calls GET /v2/public-keys", async () => {
    const fetch = mockFetch(keysResp);
    const resource = new ToolkitResource(makeHttp(fetch as any));
    await resource.getPublicKeys();
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/public-keys");
  });

  it("returns public key array", async () => {
    const resource = new ToolkitResource(makeHttp(mockFetch(keysResp) as any));
    const result = await resource.getPublicKeys();
    expect(result.keys).toHaveLength(1);
    expect(result.keys[0]?.kid).toBe("key-1");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCES
// ═════════════════════════════════════════════════════════════════════════════

describe("FinancesResource.getWalletBalances", () => {
  const balancesResp = {
    balances: [
      { provider: "MTN_MOMO_UGA", currency: "UGX", balance: "1500000", country: "UGA", status: "OPERATIONAL" },
      { provider: "AIRTEL_OAPI_UGA", currency: "UGX", balance: "250000", country: "UGA", status: "OPERATIONAL" },
    ],
  };

  it("calls GET /v2/wallets/balances", async () => {
    const fetch = mockFetch(balancesResp);
    const resource = new FinancesResource(makeHttp(fetch as any));
    await resource.getWalletBalances();
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/wallets/balances");
  });

  it("returns balances array", async () => {
    const resource = new FinancesResource(makeHttp(mockFetch(balancesResp) as any));
    const result = await resource.getWalletBalances();
    expect(result.balances).toHaveLength(2);
    expect(result.balances[0]?.provider).toBe("MTN_MOMO_UGA");
    expect(result.balances[0]?.balance).toBe("1500000");
  });
});

describe("FinancesResource.initiateStatement", () => {
  const stmtResp = { statementId: STATEMENT_ID, status: "ACCEPTED", created: "2024-06-01T00:00:00Z" };

  it("calls POST /v2/statements", async () => {
    const fetch = mockFetch(stmtResp);
    const resource = new FinancesResource(makeHttp(fetch as any));
    await resource.initiateStatement({
      statementId: STATEMENT_ID,
      fromDateTime: "2024-01-01T00:00:00Z",
      toDateTime: "2024-01-31T23:59:59Z",
    });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/statements");
    expect(init.method).toBe("POST");
  });

  it("sends correct body", async () => {
    const fetch = mockFetch(stmtResp);
    const resource = new FinancesResource(makeHttp(fetch as any));
    await resource.initiateStatement({
      statementId: STATEMENT_ID,
      fromDateTime: "2024-01-01T00:00:00Z",
      toDateTime: "2024-01-31T23:59:59Z",
    });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.statementId).toBe(STATEMENT_ID);
    expect(body.fromDateTime).toBe("2024-01-01T00:00:00Z");
  });

  it("throws PawaPayValidationError for invalid statementId", async () => {
    const resource = new FinancesResource(makeHttp(mockFetch(stmtResp) as any));
    await expect(
      resource.initiateStatement({
        statementId: "not-a-uuid",
        fromDateTime: "2024-01-01T00:00:00Z",
        toDateTime: "2024-01-31T23:59:59Z",
      })
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws when fromDateTime is missing", async () => {
    const resource = new FinancesResource(makeHttp(mockFetch(stmtResp) as any));
    await expect(
      resource.initiateStatement({
        statementId: STATEMENT_ID,
        fromDateTime: "",
        toDateTime: "2024-01-31T23:59:59Z",
      })
    ).rejects.toThrow();
  });
});

describe("FinancesResource.checkStatementStatus", () => {
  const completedResp = {
    statementId: STATEMENT_ID,
    status: "COMPLETED",
    url: "https://files.pawapay.io/statements/abc.csv",
  };

  it("calls GET /v2/statements/:id", async () => {
    const fetch = mockFetch(completedResp);
    const resource = new FinancesResource(makeHttp(fetch as any));
    await resource.checkStatementStatus(STATEMENT_ID);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/statements/${STATEMENT_ID}`);
  });

  it("returns download URL when COMPLETED", async () => {
    const resource = new FinancesResource(makeHttp(mockFetch(completedResp) as any));
    const result = await resource.checkStatementStatus(STATEMENT_ID);
    expect(result.status).toBe("COMPLETED");
    expect(result.url).toContain("pawapay.io");
  });

  it("throws for invalid statementId", async () => {
    const resource = new FinancesResource(makeHttp(mockFetch(completedResp) as any));
    await expect(resource.checkStatementStatus("bad-id")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENT PAGE
// ═════════════════════════════════════════════════════════════════════════════

describe("PaymentPageResource.generateId", () => {
  it("returns a valid UUIDv4", () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch({}) as any));
    expect(isValidUUID(resource.generateId())).toBe(true);
  });
});

describe("PaymentPageResource.createDeposit – validation", () => {
  it("throws for invalid depositId", async () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch({}) as any));
    await expect(
      resource.createDeposit({ depositId: "bad", amount: "5000", currency: "UGX" })
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid amount", async () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch({}) as any));
    await expect(
      resource.createDeposit({ depositId: DEPOSIT_ID, amount: "00", currency: "UGX" })
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid currency", async () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch({}) as any));
    await expect(
      resource.createDeposit({ depositId: DEPOSIT_ID, amount: "5000", currency: "UGXX" })
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid customerMessage", async () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch({}) as any));
    await expect(
      resource.createDeposit({
        depositId: DEPOSIT_ID,
        amount: "5000",
        currency: "UGX",
        customerMessage: "x!@",
      })
    ).rejects.toThrow(PawaPayValidationError);
  });
});

describe("PaymentPageResource.createDeposit – success", () => {
  const sessionResp = {
    depositId: DEPOSIT_ID,
    status: "ACCEPTED",
    redirectUrl: "https://checkout.pawapay.io/sessions/abc123",
  };

  it("calls POST /v2/widget/sessions", async () => {
    const fetch = mockFetch(sessionResp);
    const resource = new PaymentPageResource(makeHttp(fetch as any));
    await resource.createDeposit({ depositId: DEPOSIT_ID, amount: "5000", currency: "UGX" });
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/widget/sessions");
    expect(init.method).toBe("POST");
  });

  it("sends correct body", async () => {
    const fetch = mockFetch(sessionResp);
    const resource = new PaymentPageResource(makeHttp(fetch as any));
    await resource.createDeposit({
      depositId: DEPOSIT_ID,
      amount: "5000",
      currency: "UGX",
      returnUrl: "https://app.legal/complete",
    });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.depositId).toBe(DEPOSIT_ID);
    expect(body.returnUrl).toBe("https://app.legal/complete");
  });

  it("returns redirectUrl in response", async () => {
    const resource = new PaymentPageResource(makeHttp(mockFetch(sessionResp) as any));
    const result = await resource.createDeposit({
      depositId: DEPOSIT_ID,
      amount: "5000",
      currency: "UGX",
    });
    expect(result.redirectUrl).toContain("checkout.pawapay.io");
  });
});
