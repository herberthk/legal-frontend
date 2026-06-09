/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/http-client.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient } from "../src/http-client";
import {
  PawaPayApiError,
  PawaPayNetworkError,
} from "../src/errors";
import {
  mockFetch,
  mockFetchWithRetries,
  mockFetchNetworkFailure,
  mockFetchNonJson,
  mockFetch204,
} from "./fixtures";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof HttpClient["prototype"]["request"]>[1]> = {}
) {
  return new HttpClient({
    apiToken: "test-token-abc",
    environment: "sandbox",
    fetchImpl,
    maxRetries: 0,   // default: no retries unless test overrides
    retryDelay: 0,
    timeout: 5_000,
  });
}

// ── Constructor ───────────────────────────────────────────────────────────────

describe("HttpClient – constructor", () => {
  it("uses sandbox base URL by default", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new HttpClient({ apiToken: "tok", fetchImpl: fetch as any, maxRetries: 0 });
    await client.request("/v2/test");
    const calledUrl: string = (fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain("api.sandbox.pawapay.io");
  });

  it("uses production base URL when configured", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new HttpClient({
      apiToken: "tok",
      environment: "production",
      fetchImpl: fetch as any,
      maxRetries: 0,
    });
    await client.request("/v2/test");
    const calledUrl: string = (fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain("api.pawapay.io");
    expect(calledUrl).not.toContain("sandbox");
  });

  it("uses custom baseUrl when provided", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new HttpClient({
      apiToken: "tok",
      baseUrl: "https://mock.local",
      fetchImpl: fetch as any,
      maxRetries: 0,
    });
    await client.request("/v2/deposits");
    const calledUrl: string = (fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain("https://mock.local");
  });
});

// ── Auth header ───────────────────────────────────────────────────────────────

describe("HttpClient – auth header", () => {
  it("sends Authorization: Bearer <token>", async () => {
    const fetch = mockFetch({ ok: true });
    const client = makeClient(fetch as any);
    await client.request("/v2/deposits");
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-abc");
  });

  it("sends Content-Type: application/json", async () => {
    const fetch = mockFetch({ ok: true });
    await makeClient(fetch as any).request("/v2/deposits");
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends Accept: application/json", async () => {
    const fetch = mockFetch({ ok: true });
    await makeClient(fetch as any).request("/v2/deposits");
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });

  it("includes User-Agent header", async () => {
    const fetch = mockFetch({ ok: true });
    await makeClient(fetch as any).request("/v2/deposits");
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/pawapay-ts-sdk/);
  });

  it("merges extraHeaders into every request", async () => {
    const fetch = mockFetch({ ok: true });
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 0,
      extraHeaders: { "X-App-Version": "2.0.0" },
    });
    await client.request("/v2/test");
    const headers = (fetch as any).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-App-Version"]).toBe("2.0.0");
  });
});

// ── HTTP methods & body ───────────────────────────────────────────────────────

describe("HttpClient – HTTP methods and body", () => {
  it("defaults to GET when no method specified", async () => {
    const fetch = mockFetch({});
    await makeClient(fetch as any).request("/v2/test");
    expect((fetch as any).mock.calls[0][1].method).toBe("GET");
  });

  it("sends POST with serialised JSON body", async () => {
    const fetch = mockFetch({ depositId: "abc" });
    await makeClient(fetch as any).request("/v2/deposits", {
      method: "POST",
      body: { amount: "5000", currency: "UGX" },
    });
    const init = (fetch as any).mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ amount: "5000", currency: "UGX" });
  });

  it("does not set body for GET requests", async () => {
    const fetch = mockFetch({});
    await makeClient(fetch as any).request("/v2/test", { method: "GET" });
    expect((fetch as any).mock.calls[0][1].body).toBeUndefined();
  });

  it("appends query params to URL", async () => {
    const fetch = mockFetch({});
    await makeClient(fetch as any).request("/v2/active-conf", {
      params: { country: "UGA", operationType: "DEPOSIT" },
    });
    const url: string = (fetch as any).mock.calls[0][0];
    expect(url).toContain("country=UGA");
    expect(url).toContain("operationType=DEPOSIT");
  });

  it("skips undefined query params", async () => {
    const fetch = mockFetch({});
    await makeClient(fetch as any).request("/v2/active-conf", {
      params: { country: "UGA", operationType: undefined },
    });
    const url: string = (fetch as any).mock.calls[0][0];
    expect(url).toContain("country=UGA");
    expect(url).not.toContain("operationType");
  });
});

// ── Successful response parsing ───────────────────────────────────────────────

describe("HttpClient – response parsing", () => {
  it("returns parsed JSON on 200", async () => {
    const body = { depositId: "dep-1", status: "ACCEPTED" };
    const result = await makeClient(mockFetch(body) as any).request("/v2/deposits");
    expect(result).toEqual(body);
  });

  it("returns empty object on 204 No Content", async () => {
    const result = await makeClient(mockFetch204() as any).request("/v2/resend");
    expect(result).toEqual({});
  });

  it("returns empty object on non-JSON 200 response", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } })
    );
    const result = await makeClient(fetch as any).request("/v2/test");
    expect(result).toEqual({});
  });
});

// ── Error response parsing ────────────────────────────────────────────────────

describe("HttpClient – error responses", () => {
  it("throws PawaPayApiError on 400 with failureReason body", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "INVALID_INPUT", failureMessage: "bad field" } },
      400
    );
    await expect(makeClient(fetch as any).request("/v2/deposits")).rejects.toThrow(
      PawaPayApiError
    );
  });

  it("PawaPayApiError carries correct failureCode", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "INVALID_PHONE_NUMBER", failureMessage: "bad phone" } },
      422
    );
    try {
      await makeClient(fetch as any).request("/v2/deposits");
    } catch (e) {
      expect((e as PawaPayApiError).failureCode).toBe("INVALID_PHONE_NUMBER");
      expect((e as PawaPayApiError).httpStatus).toBe(422);
    }
  });

  it("throws PawaPayApiError on 401 Unauthorized", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "NO_AUTHENTICATION", failureMessage: "missing token" } },
      401
    );
    await expect(makeClient(fetch as any).request("/v2/deposits")).rejects.toThrow(
      PawaPayApiError
    );
  });

  it("extracts x-request-id from response headers", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "UNKNOWN_ERROR", failureMessage: "oops" } },
      500,
      { "x-request-id": "req-xyz-999" }
    );
    try {
      await makeClient(fetch as any).request("/v2/deposits");
    } catch (e) {
      expect((e as PawaPayApiError).requestId).toBe("req-xyz-999");
    }
  });

  it("falls back to UNKNOWN_ERROR when failureReason is absent", async () => {
    const fetch = mockFetch({ message: "something broke" }, 500);
    try {
      await makeClient(fetch as any).request("/v2/deposits");
    } catch (e) {
      expect((e as PawaPayApiError).failureCode).toBe("UNKNOWN_ERROR");
    }
  });

  it("throws PawaPayNetworkError on non-JSON error response", async () => {
    const fetch = mockFetchNonJson(500);
    await expect(makeClient(fetch as any).request("/v2/deposits")).rejects.toThrow(
      PawaPayNetworkError
    );
  });

  it("throws PawaPayNetworkError on network-level TypeError", async () => {
    const fetch = mockFetchNetworkFailure();
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 0,
      retryDelay: 0,
    });
    await expect(client.request("/v2/deposits")).rejects.toThrow(PawaPayNetworkError);
  });
});

// ── Retry logic ───────────────────────────────────────────────────────────────

describe("HttpClient – retry logic", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries on 503 and succeeds on the next attempt", async () => {
    const successBody = { depositId: "dep-1", status: "ACCEPTED" };
    const fetch = mockFetchWithRetries(successBody, 1, 503);
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 3,
      retryDelay: 10,
    });
    const promise = client.request("/v2/deposits");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual(successBody);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on TypeError (network failure) and succeeds", async () => {
    let calls = 0;
    const fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 2) return Promise.reject(new TypeError("fetch failed"));
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 3,
      retryDelay: 10,
    });
    const promise = client.request("/v2/deposits");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400 bad request", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "INVALID_INPUT", failureMessage: "bad" } },
      400
    );
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 3,
      retryDelay: 10,
    });
    const promise = client.request("/v2/deposits");
    const assertion = expect(promise).rejects.toThrow(PawaPayApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 unauthorized", async () => {
    const fetch = mockFetch(
      { failureReason: { failureCode: "NO_AUTHENTICATION", failureMessage: "x" } },
      401
    );
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 3,
      retryDelay: 10,
    });
    const promise = client.request("/v2/deposits");
    const assertion = expect(promise).rejects.toThrow(PawaPayApiError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries and throws PawaPayNetworkError", async () => {
    const fetch = mockFetchNetworkFailure("always fails");
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 2,
      retryDelay: 10,
    });
    const promise = client.request("/v2/deposits");
    const assertion = expect(promise).rejects.toThrow(PawaPayNetworkError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("throws PawaPayNetworkError on AbortError when caller aborts", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(() => {
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const client = new HttpClient({
      apiToken: "tok",
      fetchImpl: fetch as any,
      maxRetries: 3,
      retryDelay: 0,
    });
    const promise = client.request("/v2/deposits", {
      signal: controller.signal,
    });
    const assertion = expect(promise).rejects.toThrow(PawaPayNetworkError);
    await vi.runAllTimersAsync();
    await assertion;
    // Should not retry when caller aborts
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
