/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/client.ts  (PawaPayClient integration)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { PawaPayClient } from "../src/client";
import { DepositsResource } from "../src/resources/deposits";
import { PayoutsResource } from "../src/resources/payouts";
import { RefundsResource } from "../src/resources/refunds";
import { RemittancesResource } from "../src/resources/remittances";
import { ToolkitResource } from "../src/resources/toolkit";
import { FinancesResource } from "../src/resources/finances";
import { PaymentPageResource } from "../src/resources/payment-page";
import {
  mockFetch,
  makeDepositAccepted,
  makePayoutAccepted,
  makeRefundAccepted,
  makeDepositRequest,
  makePayoutRequest,
  makeRefundRequest,
  DEPOSIT_ID,
  PAYOUT_ID,
  REMIT_ID,
} from "./fixtures.js";

// ── Constructor guards ────────────────────────────────────────────────────────

describe("PawaPayClient – constructor", () => {
  it("constructs without error when apiToken is provided", () => {
    expect(
      () => new PawaPayClient({ apiToken: "test-token", environment: "sandbox" })
    ).not.toThrow();
  });

  it("throws when apiToken is empty string", () => {
    expect(() => new PawaPayClient({ apiToken: "" })).toThrow();
  });

  it("throws when apiToken is missing", () => {
    expect(
      // @ts-expect-error — intentional invalid call
      () => new PawaPayClient({})
    ).toThrow();
  });
});

// ── Lazy resource initialisation ──────────────────────────────────────────────

describe("PawaPayClient – resource accessors", () => {
  const client = new PawaPayClient({ apiToken: "tok" });

  it("exposes deposits resource", () => {
    expect(client.deposits).toBeInstanceOf(DepositsResource);
  });

  it("exposes payouts resource", () => {
    expect(client.payouts).toBeInstanceOf(PayoutsResource);
  });

  it("exposes refunds resource", () => {
    expect(client.refunds).toBeInstanceOf(RefundsResource);
  });

  it("exposes remittances resource", () => {
    expect(client.remittances).toBeInstanceOf(RemittancesResource);
  });

  it("exposes toolkit resource", () => {
    expect(client.toolkit).toBeInstanceOf(ToolkitResource);
  });

  it("exposes finances resource", () => {
    expect(client.finances).toBeInstanceOf(FinancesResource);
  });

  it("exposes paymentPage resource", () => {
    expect(client.paymentPage).toBeInstanceOf(PaymentPageResource);
  });

  it("returns the same instance on repeated access (lazy singleton)", () => {
    expect(client.deposits).toBe(client.deposits);
    expect(client.payouts).toBe(client.payouts);
    expect(client.toolkit).toBe(client.toolkit);
  });
});

// ── End-to-end flow with mock fetch ──────────────────────────────────────────

describe("PawaPayClient – end-to-end flows (mock fetch)", () => {
  it("deposit → checkStatus flow", async () => {
    const initiateResp = makeDepositAccepted();
    const statusResp = { ...initiateResp, finalStatus: "COMPLETED", amount: "5000" };

    let callCount = 0;
    const fetchImpl = async (url: string, init: RequestInit) => {
      callCount++;
      const body = callCount === 1 ? initiateResp : statusResp;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: fetchImpl as any,
      maxRetries: 0,
    });

    const initiated = await client.deposits.initiate(makeDepositRequest());
    expect(initiated.status).toBe("ACCEPTED");

    const status = await client.deposits.checkStatus(DEPOSIT_ID);
    expect(status.finalStatus).toBe("COMPLETED");
    expect(callCount).toBe(2);
  });

  it("payout → cancel flow", async () => {
    const payoutResp = makePayoutAccepted();
    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      const body = callCount === 1 ? payoutResp : {};
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: fetchImpl as any,
      maxRetries: 0,
    });

    const payout = await client.payouts.initiate(makePayoutRequest());
    expect(payout.status).toBe("ACCEPTED");

    await expect(client.payouts.cancelEnqueued(PAYOUT_ID)).resolves.toBeUndefined();
    expect(callCount).toBe(2);
  });

  it("refund initiate flow", async () => {
    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: mockFetch(makeRefundAccepted()) as any,
      maxRetries: 0,
    });
    const result = await client.refunds.initiate(makeRefundRequest());
    expect(result.status).toBe("ACCEPTED");
  });

  it("toolkit predictProvider flow", async () => {
    const predResp = { country: "UGA", provider: "MTN_MOMO_UGA", phoneNumber: "256700123456" };
    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: mockFetch(predResp) as any,
      maxRetries: 0,
    });
    const result = await client.toolkit.predictProvider({ phoneNumber: "256700123456" });
    expect(result.provider).toBe("MTN_MOMO_UGA");
  });

  it("bulk payout flow", async () => {
    const bulkResp = {
      payouts: [
        makePayoutAccepted("a1b2c3d4-e5f6-4789-abcd-ef0123456789"),
        makePayoutAccepted("b2c3d4e5-f6a7-4890-bcde-f01234567890"),
      ],
    };
    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: mockFetch(bulkResp) as any,
      maxRetries: 0,
    });

    const result = await client.payouts.initiateBulk({
      payouts: [
        makePayoutRequest({ payoutId: "a1b2c3d4-e5f6-4789-abcd-ef0123456789" }),
        makePayoutRequest({ payoutId: "b2c3d4e5-f6a7-4890-bcde-f01234567890" }),
      ],
    });
    expect(result.payouts).toHaveLength(2);
  });

  it("wallet balances flow", async () => {
    const balancesResp = {
      balances: [
        { provider: "MTN_MOMO_UGA", currency: "UGX", balance: "2500000", country: "UGA", status: "OPERATIONAL" },
      ],
    };
    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: mockFetch(balancesResp) as any,
      maxRetries: 0,
    });
    const result = await client.finances.getWalletBalances();
    expect(result.balances[0]?.balance).toBe("2500000");
  });

  it("payment page createDeposit flow", async () => {
    const sessionResp = {
      depositId: DEPOSIT_ID,
      status: "ACCEPTED",
      redirectUrl: "https://checkout.pawapay.io/sessions/xyz",
    };
    const client = new PawaPayClient({
      apiToken: "tok",
      fetchImpl: mockFetch(sessionResp) as any,
      maxRetries: 0,
    });
    const result = await client.paymentPage.createDeposit({
      depositId: DEPOSIT_ID,
      amount: "5000",
      currency: "UGX",
    });
    expect(result.redirectUrl).toContain("checkout.pawapay.io");
  });
});

// ── Production environment routing ────────────────────────────────────────────

describe("PawaPayClient – environment routing", () => {
  it("routes to sandbox URL by default", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new PawaPayClient({ apiToken: "tok", fetchImpl: fetch as any, maxRetries: 0 });
    await client.toolkit.getProviderAvailability();
    const calledUrl = (fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("sandbox.pawapay.io");
  });

  it("routes to production URL when environment is 'production'", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new PawaPayClient({
      apiToken: "tok",
      environment: "production",
      fetchImpl: fetch as any,
      maxRetries: 0,
    });
    await client.toolkit.getProviderAvailability();
    const calledUrl = (fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("sandbox");
    expect(calledUrl).toContain("api.pawapay.io");
  });
});
