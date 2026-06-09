/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/resources/deposits.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from "vitest";
import { DepositsResource } from "../src/resources/deposits";
import { HttpClient } from "../src/http-client";
import { PawaPayValidationError } from "../src/errors";
import { isValidUUID } from "../src/utils";
import {
  mockFetch,
  makeDepositRequest,
  makeDepositAccepted,
  makeDepositCompleted,
  makeDepositFailed,
  DEPOSIT_ID,
} from "./fixtures";

function makeResource(fetchImpl: typeof fetch) {
  const client = new HttpClient({
    apiToken: "test-tok",
    fetchImpl: fetchImpl as any,
    maxRetries: 0,
    retryDelay: 0,
  });
  return new DepositsResource(client);
}

// ── generateId ────────────────────────────────────────────────────────────────

describe("DepositsResource.generateId", () => {
  it("returns a valid UUIDv4", () => {
    const resource = makeResource(mockFetch({}) as any);
    expect(isValidUUID(resource.generateId())).toBe(true);
  });

  it("returns unique IDs on each call", () => {
    const resource = makeResource(mockFetch({}) as any);
    const ids = new Set(Array.from({ length: 20 }, () => resource.generateId()));
    expect(ids.size).toBe(20);
  });
});

// ── initiate – validation ─────────────────────────────────────────────────────

describe("DepositsResource.initiate – validation", () => {
  it("throws PawaPayValidationError for invalid depositId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ depositId: "not-a-uuid" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws PawaPayValidationError for invalid amount", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ amount: "01" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws PawaPayValidationError for amount with leading zero", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ amount: "01000" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws PawaPayValidationError for phone number with leading zero", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(
        makeDepositRequest({
          payer: {
            type: "MMO",
            accountDetails: { phoneNumber: "0700123456", provider: "MTN_MOMO_UGA" },
          },
        })
      )
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws PawaPayValidationError for phone number with + prefix", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(
        makeDepositRequest({
          payer: {
            type: "MMO",
            accountDetails: { phoneNumber: "+256700123456", provider: "MTN_MOMO_UGA" },
          },
        })
      )
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for invalid currency (too short)", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ currency: "UG" }))
    ).rejects.toThrow();
  });

  it("throws for invalid customerMessage (too short)", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ customerMessage: "hi" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for customerMessage with special chars", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(makeDepositRequest({ customerMessage: "pay@me!" }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for metadata with more than 10 items", async () => {
    const resource = makeResource(mockFetch({}) as any);
    const metadata = Array.from({ length: 11 }, (_, i) => ({ [`key${i}`]: "v" }));
    await expect(
      resource.initiate(makeDepositRequest({ metadata }))
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("throws for duplicate metadata keys", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(
      resource.initiate(
        makeDepositRequest({ metadata: [{ orderId: "1" }, { orderId: "2" }] })
      )
    ).rejects.toThrow(PawaPayValidationError);
  });

  it("does NOT call fetch when validation fails", async () => {
    const fetch = mockFetch({});
    const resource = makeResource(fetch as any);
    await resource.initiate(makeDepositRequest({ depositId: "bad" })).catch(() => {});
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ── initiate – happy path ─────────────────────────────────────────────────────

describe("DepositsResource.initiate – success", () => {
  it("calls POST /v2/deposits", async () => {
    const fetch = mockFetch(makeDepositAccepted());
    const resource = makeResource(fetch as any);
    await resource.initiate(makeDepositRequest());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain("/v2/deposits");
    expect(init.method).toBe("POST");
  });

  it("sends the correct request body as JSON", async () => {
    const fetch = mockFetch(makeDepositAccepted());
    const resource = makeResource(fetch as any);
    const req = makeDepositRequest();
    await resource.initiate(req);
    const sentBody = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(sentBody.depositId).toBe(DEPOSIT_ID);
    expect(sentBody.amount).toBe("5000");
    expect(sentBody.currency).toBe("UGX");
  });

  it("returns ACCEPTED response", async () => {
    const expected = makeDepositAccepted();
    const resource = makeResource(mockFetch(expected) as any);
    const result = await resource.initiate(makeDepositRequest());
    expect(result.depositId).toBe(DEPOSIT_ID);
    expect(result.status).toBe("ACCEPTED");
  });

  it("accepts optional metadata without throwing", async () => {
    const fetch = mockFetch(makeDepositAccepted());
    const resource = makeResource(fetch as any);
    await expect(
      resource.initiate(
        makeDepositRequest({ metadata: [{ orderId: "ORD-001" }, { userId: "usr-42" }] })
      )
    ).resolves.toBeDefined();
  });

  it("accepts optional customerMessage", async () => {
    const fetch = mockFetch(makeDepositAccepted());
    const resource = makeResource(fetch as any);
    await expect(
      resource.initiate(makeDepositRequest({ customerMessage: "LegalAdviser" }))
    ).resolves.toBeDefined();
  });

  it("includes preAuthorisationCode in body when provided", async () => {
    const fetch = mockFetch(makeDepositAccepted());
    const resource = makeResource(fetch as any);
    await resource.initiate(makeDepositRequest({ preAuthorisationCode: "PRE-123" }));
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.preAuthorisationCode).toBe("PRE-123");
  });
});

// ── initiate – REJECTED response ──────────────────────────────────────────────

describe("DepositsResource.initiate – duplicate/rejected", () => {
  it("returns DUPLICATE_IGNORED status without throwing", async () => {
    const duplicateResp = { depositId: DEPOSIT_ID, status: "DUPLICATE_IGNORED" };
    const resource = makeResource(mockFetch(duplicateResp) as any);
    const result = await resource.initiate(makeDepositRequest());
    expect(result.status).toBe("DUPLICATE_IGNORED");
  });
});

// ── checkStatus ───────────────────────────────────────────────────────────────

describe("DepositsResource.checkStatus", () => {
  it("calls GET /v2/deposits/:id", async () => {
    const fetch = mockFetch(makeDepositCompleted());
    const resource = makeResource(fetch as any);
    await resource.checkStatus(DEPOSIT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/deposits/${DEPOSIT_ID}`);
    expect(init.method).toBe("GET");
  });

  it("returns a COMPLETED status response", async () => {
    const resource = makeResource(mockFetch(makeDepositCompleted()) as any);
    const result = await resource.checkStatus(DEPOSIT_ID);
    expect(result.finalStatus).toBe("COMPLETED");
    expect(result.currency).toBe("UGX");
  });

  it("returns a FAILED status response", async () => {
    const resource = makeResource(mockFetch(makeDepositFailed()) as any);
    const result = await resource.checkStatus(DEPOSIT_ID);
    expect(result.finalStatus).toBe("FAILED");
    expect(result.failureReason?.failureCode).toBe("INVALID_PHONE_NUMBER");
  });

  it("throws PawaPayValidationError for invalid depositId format", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.checkStatus("bad-id")).rejects.toThrow(
      PawaPayValidationError
    );
  });

  it("does not call fetch when depositId is invalid", async () => {
    const fetch = mockFetch({});
    const resource = makeResource(fetch as any);
    await resource.checkStatus("invalid").catch(() => {});
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ── resendCallback ────────────────────────────────────────────────────────────

describe("DepositsResource.resendCallback", () => {
  it("calls POST /v2/deposits/:id/resend-callback", async () => {
    const fetch = mockFetch({});
    const resource = makeResource(fetch as any);
    await resource.resendCallback(DEPOSIT_ID);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toContain(`/v2/deposits/${DEPOSIT_ID}/resend-callback`);
    expect(init.method).toBe("POST");
  });

  it("resolves to void on success", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.resendCallback(DEPOSIT_ID)).resolves.toBeUndefined();
  });

  it("throws PawaPayValidationError for invalid depositId", async () => {
    const resource = makeResource(mockFetch({}) as any);
    await expect(resource.resendCallback("not-uuid")).rejects.toThrow(
      PawaPayValidationError
    );
  });
});
