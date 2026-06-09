/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/resources/refunds.ts  &  src/resources/remittances.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { RefundsResource } from "../src/resources/refunds";
import { RemittancesResource } from "../src/resources/remittances";
import { HttpClient } from "../src/http-client";
import { PawaPayValidationError } from "../src/errors";
import { isValidUUID } from "../src/utils";
import {
  mockFetch,
  makeRefundRequest,
  makeRemittanceRequest,
  makeRefundAccepted,
  makeRefundCompleted,
  makePayoutAccepted,
  REFUND_ID,
  DEPOSIT_ID,
  REMIT_ID,
} from "./fixtures.js";
import { TransactionStatus } from "../src/types/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRefundResource(fetchImpl: typeof fetch) {
  return new RefundsResource(
    new HttpClient({ apiToken: "tok", fetchImpl: fetchImpl as any, maxRetries: 0, retryDelay: 0 })
  );
}

function makeRemittanceResource(fetchImpl: typeof fetch) {
  return new RemittancesResource(
    new HttpClient({ apiToken: "tok", fetchImpl: fetchImpl as any, maxRetries: 0, retryDelay: 0 })
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// REFUNDS
// ═════════════════════════════════════════════════════════════════════════════

describe("RefundsResource.generateId", () => {
  it("returns a valid UUIDv4", () => {
    expect(isValidUUID(makeRefundResource(mockFetch({}) as any).generateId())).toBe(true);
  });
});

// ── initiate – validation ─────────────────────────────────────────────────────

describe("RefundsResource.initiate – validation", () => {
  it("throws for invalid refundId", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRefundRequest({ refundId: "bad" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid depositId", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRefundRequest({ depositId: "not-a-uuid" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid amount", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRefundRequest({ amount: "-100" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid currency", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRefundRequest({ currency: "XY" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for metadata with more than 10 items", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    const metadata = Array.from({ length: 11 }, (_, i) => ({ [`key${i}`]: "v" }));
    await expect(
      resource.initiate(makeRefundRequest({ metadata }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("does not call fetch when validation fails", async () => {
    const fetch = mockFetch({});
    const resource = makeRefundResource(fetch as any);
    await resource.initiate(makeRefundRequest({ refundId: "bad" })).catch(() => {});
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ── initiate – success ────────────────────────────────────────────────────────

describe("RefundsResource.initiate – success", () => {
  it("calls POST /v2/refunds", async () => {
    const fetch = mockFetch(makeRefundAccepted());
    const resource = makeRefundResource(fetch as any);
    await resource.initiate(makeRefundRequest());
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/refunds");
    expect(init.method).toBe("POST");
  });

  it("sends correct body", async () => {
    const fetch = mockFetch(makeRefundAccepted());
    const resource = makeRefundResource(fetch as any);
    await resource.initiate(makeRefundRequest());
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.refundId).toBe(REFUND_ID);
    expect(body.depositId).toBe(DEPOSIT_ID);
    expect(body.amount).toBe("5000");
    expect(body.currency).toBe("UGX");
  });

  it("returns ACCEPTED status", async () => {
    const resource = makeRefundResource(mockFetch(makeRefundAccepted()) as any);
    const result = await resource.initiate(makeRefundRequest());
    expect(result.status).toBe(TransactionStatus.ACCEPTED);
  });

  it("accepts optional metadata", async () => {
    const fetch = mockFetch(makeRefundAccepted());
    const resource = makeRefundResource(fetch as any);
    await expect(
      resource.initiate(makeRefundRequest({ metadata: [{ reason: "duplicate" }] }))
    ).resolves.toBeDefined();
  });
});

// ── checkStatus ───────────────────────────────────────────────────────────────

describe("RefundsResource.checkStatus", () => {
  it("calls GET /v2/refunds/:id", async () => {
    const fetch = mockFetch(makeRefundCompleted());
    const resource = makeRefundResource(fetch as any);
    await resource.checkStatus(REFUND_ID);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/refunds/${REFUND_ID}`);
  });

  it("returns COMPLETED response", async () => {
    const resource = makeRefundResource(mockFetch(makeRefundCompleted()) as any);
    const result = await resource.checkStatus(REFUND_ID);
    expect(result.finalStatus).toBe("COMPLETED");
  });

  it("throws for invalid refundId", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(resource.checkStatus("bad")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});

// ── resendCallback ────────────────────────────────────────────────────────────

describe("RefundsResource.resendCallback", () => {
  it("calls POST /v2/refunds/:id/resend-callback", async () => {
    const fetch = mockFetch({});
    const resource = makeRefundResource(fetch as any);
    await resource.resendCallback(REFUND_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/refunds/${REFUND_ID}/resend-callback`);
    expect(init.method).toBe("POST");
  });

  it("throws for invalid refundId", async () => {
    const resource = makeRefundResource(mockFetch({}) as any);
    await expect(resource.resendCallback("not-uuid")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REMITTANCES
// ═════════════════════════════════════════════════════════════════════════════

describe("RemittancesResource.generateId", () => {
  it("returns a valid UUIDv4", () => {
    expect(isValidUUID(makeRemittanceResource(mockFetch({}) as any).generateId())).toBe(true);
  });
});

// ── initiate – validation ─────────────────────────────────────────────────────

describe("RemittancesResource.initiate – validation", () => {
  it("throws for invalid remittanceId", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRemittanceRequest({ remittanceId: "bad" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid amount", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRemittanceRequest({ amount: "00" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid phone in recipient", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(
      resource.initiate(
        makeRemittanceRequest({
          recipient: {
            type: "MMO",
            accountDetails: { phoneNumber: "0700000000", provider: "MTN_MOMO_UGA" },
          },
        })
      )
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid currency", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRemittanceRequest({ currency: "US" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid customerMessage", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeRemittanceRequest({ customerMessage: "x!" }))
    ).rejects.toThrow(PawaPayValidationError);
  });
});

// ── initiate – success ────────────────────────────────────────────────────────

describe("RemittancesResource.initiate – success", () => {
  const remitAccepted = { remittanceId: REMIT_ID, status: "ACCEPTED", created: "2024-06-01T12:00:00Z" };

  it("calls POST /v2/remittances", async () => {
    const fetch = mockFetch(remitAccepted);
    const resource = makeRemittanceResource(fetch as any);
    await resource.initiate(makeRemittanceRequest());
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/remittances");
    expect(init.method).toBe("POST");
  });

  it("sends correct body", async () => {
    const fetch = mockFetch(remitAccepted);
    const resource = makeRemittanceResource(fetch as any);
    await resource.initiate(makeRemittanceRequest());
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.remittanceId).toBe(REMIT_ID);
    expect(body.amount).toBe("50000");
  });

  it("returns ACCEPTED status", async () => {
    const resource = makeRemittanceResource(mockFetch(remitAccepted) as any);
    const result = await resource.initiate(makeRemittanceRequest());
    expect(result.status).toBe(TransactionStatus.ACCEPTED);
  });
});

// ── checkStatus ───────────────────────────────────────────────────────────────

describe("RemittancesResource.checkStatus", () => {
  it("calls GET /v2/remittances/:id", async () => {
    const fetch = mockFetch({ remittanceId: REMIT_ID, status: "ACCEPTED", finalStatus: "COMPLETED" });
    const resource = makeRemittanceResource(fetch as any);
    await resource.checkStatus(REMIT_ID);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/remittances/${REMIT_ID}`);
  });

  it("throws for invalid remittanceId", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(resource.checkStatus("nope")).rejects.toThrow(PawaPayValidationError);
  });
});

// ── cancelEnqueued ────────────────────────────────────────────────────────────

describe("RemittancesResource.cancelEnqueued", () => {
  it("calls POST /v2/remittances/:id/cancel", async () => {
    const fetch = mockFetch({});
    const resource = makeRemittanceResource(fetch as any);
    await resource.cancelEnqueued(REMIT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/remittances/${REMIT_ID}/cancel`);
    expect(init.method).toBe("POST");
  });

  it("throws for invalid remittanceId", async () => {
    const resource = makeRemittanceResource(mockFetch({}) as any);
    await expect(resource.cancelEnqueued("bad")).rejects.toThrow(PawaPayValidationError);
  });
});

// ── resendCallback ────────────────────────────────────────────────────────────

describe("RemittancesResource.resendCallback", () => {
  it("calls POST /v2/remittances/:id/resend-callback", async () => {
    const fetch = mockFetch({});
    const resource = makeRemittanceResource(fetch as any);
    await resource.resendCallback(REMIT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/remittances/${REMIT_ID}/resend-callback`);
    expect(init.method).toBe("POST");
  });
});
