/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/resources/payouts.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { PayoutsResource } from "../src/resources/payouts";
import { HttpClient } from "../src/http-client";
import { PawaPayValidationError } from "../src/errors";
import { isValidUUID } from "../src/utils";
import {
  mockFetch,
  makePayoutRequest,
  makePayoutAccepted,
  makePayoutCompleted,
  PAYOUT_ID,
  ugaAirtelRecipient,
} from "./fixtures";
import { TransactionStatus } from "../src/types";

function makeResource(fetchImpl: typeof fetch) {
  const client = new HttpClient({
    apiToken: "test-tok",
    fetchImpl: fetchImpl as any,
    maxRetries: 0,
    retryDelay: 0,
  });
  return new PayoutsResource(client);
}

// ── generateId ────────────────────────────────────────────────────────────────

describe("PayoutsResource.generateId", () => {
  it("returns a valid UUIDv4", () => {
    expect(isValidUUID(makeResource(mockFetch({}) as any).generateId())).toBe(true);
  });
});

// ── initiate – validation ─────────────────────────────────────────────────────

describe("PayoutsResource.initiate – validation", () => {
  it("throws for invalid payoutId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makePayoutRequest({ payoutId: "bad" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid amount", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makePayoutRequest({ amount: "01" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid phone number in recipient", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(
        makePayoutRequest({
          recipient: {
            type: "MMO",
            accountDetails: { phoneNumber: "0700123456", provider: "AIRTEL_OAPI_UGA" },
          },
        })
      )
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for currency not exactly 3 chars", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makePayoutRequest({ currency: "UGXX" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid customerMessage", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makePayoutRequest({ customerMessage: "x" }))
    ).rejects.toThrow(PawaPayValidationError);
  });
});

// ── initiate – success ────────────────────────────────────────────────────────

describe("PayoutsResource.initiate – success", () => {
  it("calls POST /v2/payouts", async () => {
    const fetch = mockFetch(makePayoutAccepted());
    const resource = makeResource(fetch as any);
    await resource.initiate(makePayoutRequest());
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/payouts");
    expect(init.method).toBe("POST");
  });

  it("serialises request body correctly", async () => {
    const fetch = mockFetch(makePayoutAccepted());
    const resource = makeResource(fetch as any);
    await resource.initiate(makePayoutRequest());
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.payoutId).toBe(PAYOUT_ID);
    expect(body.amount).toBe("10000");
    expect(body.recipient.accountDetails.provider).toBe("AIRTEL_OAPI_UGA");
  });

  it("returns ACCEPTED response", async () => {
    const resource = makeResource(mockFetch(makePayoutAccepted()) as any);
    const result = await resource.initiate(makePayoutRequest());
    expect(result.status).toBe(TransactionStatus.ACCEPTED);
    expect(result.payoutId).toBe(PAYOUT_ID);
  });
});

// ── initiateBulk – validation ─────────────────────────────────────────────────

describe("PayoutsResource.initiateBulk – validation", () => {
  it("throws for empty payouts array", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.initiateBulk({ payouts: [] })).rejects.toThrow(
      PawaPayValidationError
    );
    await expect(resource.initiateBulk({ payouts: [] })).rejects.toThrow(
      /at least one/
    );
  });

  it("throws for more than 100 payouts", async () => {
    const resource = makeResource(mockFetch({}) as any);
    const payouts = Array.from({ length: 101 }, (_, i) =>
      makePayoutRequest({ payoutId: `a1b2c3d4-e5f6-4789-abcd-${String(i).padStart(12, "0")}` })
    );
    await expect(resource.initiateBulk({ payouts })).rejects.toThrow(
      PawaPayValidationError
    );
    await expect(
      resource.initiateBulk({ payouts })
    ).rejects.toThrow(/maximum of 100/);
  });

  it("throws with index context for invalid item inside bulk", async () => {
    const resource = makeResource(mockFetch({}) as any);
    const payouts = [
      makePayoutRequest(), // valid
      makePayoutRequest({ payoutId: "bad-id" }), // invalid
    ];
    try {
      await resource.initiateBulk({ payouts });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as PawaPayValidationError).field).toContain("payouts[1]");
    }
  });
});

// ── initiateBulk – success ────────────────────────────────────────────────────

describe("PayoutsResource.initiateBulk – success", () => {
  it("calls POST /v2/payouts/bulk", async () => {
    const responseBody = {
      payouts: [makePayoutAccepted(), makePayoutAccepted()],
    };
    const fetch = mockFetch(responseBody);
    const resource = makeResource(fetch as any);

    const p1 = makePayoutRequest({ payoutId: "a1b2c3d4-e5f6-4789-abcd-ef0123456789" });
    const p2 = makePayoutRequest({ payoutId: "b2c3d4e5-f6a7-4890-bcde-f01234567890" });
    await resource.initiateBulk({ payouts: [p1, p2] });

    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/payouts/bulk");
    expect(init.method).toBe("POST");
  });

  it("returns array of payout responses", async () => {
    const p1Resp = makePayoutAccepted("a1b2c3d4-e5f6-4789-abcd-ef0123456789");
    const p2Resp = makePayoutAccepted("b2c3d4e5-f6a7-4890-bcde-f01234567890");
    const resource = makeResource(mockFetch({ payouts: [p1Resp, p2Resp] }) as any);

    const p1 = makePayoutRequest({ payoutId: "a1b2c3d4-e5f6-4789-abcd-ef0123456789" });
    const p2 = makePayoutRequest({ payoutId: "b2c3d4e5-f6a7-4890-bcde-f01234567890" });
    const result = await resource.initiateBulk({ payouts: [p1, p2] });

    expect(result.payouts).toHaveLength(2);
    expect(result.payouts[0]?.status).toBe(TransactionStatus.ACCEPTED);
  });

  it("accepts exactly 100 payouts (boundary)", async () => {
    const responsePayouts = Array.from({ length: 100 }, (_, i) =>
      makePayoutAccepted(`a1b2c3d4-e5f6-4789-abcd-${String(i).padStart(12, "0")}`)
    );
    const fetch = mockFetch({ payouts: responsePayouts });
    const resource = makeResource(fetch as any);

    const payouts = Array.from({ length: 100 }, (_, i) =>
      makePayoutRequest({
        payoutId: `a1b2c3d4-e5f6-4789-abcd-${String(i).padStart(12, "0")}`,
      })
    );
    await expect(resource.initiateBulk({ payouts })).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ── checkStatus ───────────────────────────────────────────────────────────────

describe("PayoutsResource.checkStatus", () => {
  it("calls GET /v2/payouts/:id", async () => {
    const fetch = mockFetch(makePayoutCompleted());
    const resource = makeResource(fetch as any);
    await resource.checkStatus(PAYOUT_ID);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/payouts/${PAYOUT_ID}`);
  });

  it("returns finalStatus COMPLETED", async () => {
    const resource = makeResource(mockFetch(makePayoutCompleted()) as any);
    const result = await resource.checkStatus(PAYOUT_ID);
    expect(result.finalStatus).toBe("COMPLETED");
  });

  it("throws PawaPayValidationError for invalid payoutId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.checkStatus("not-valid")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});

// ── cancelEnqueued ────────────────────────────────────────────────────────────

describe("PayoutsResource.cancelEnqueued", () => {
  it("calls POST /v2/payouts/:id/cancel", async () => {
    const fetch = mockFetch({});
    const resource = makeResource(fetch as any);
    await resource.cancelEnqueued(PAYOUT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/payouts/${PAYOUT_ID}/cancel`);
    expect(init.method).toBe("POST");
  });

  it("resolves to void", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.cancelEnqueued(PAYOUT_ID)).resolves.toBeUndefined();
  });

  it("throws PawaPayValidationError for invalid payoutId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.cancelEnqueued("bad")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});

// ── resendCallback ────────────────────────────────────────────────────────────

describe("PayoutsResource.resendCallback", () => {
  it("calls POST /v2/payouts/:id/resend-callback", async () => {
    const fetch = mockFetch({});
    const resource = makeResource(fetch as any);
    await resource.resendCallback(PAYOUT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/payouts/${PAYOUT_ID}/resend-callback`);
    expect(init.method).toBe("POST");
  });

  it("throws for invalid payoutId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.resendCallback("nope")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});
