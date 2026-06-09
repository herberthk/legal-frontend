// ─────────────────────────────────────────────────────────────────────────────
// Tests: src/utils/polling.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollUntilFinal, pollUntilFinalOrThrow } from "../src/utils/polling";
import { PawaPayError } from "../src/errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a checkFn that returns ACCEPTED for the first N calls then COMPLETED */
function checkFnAfter(
  completesOnAttempt: number,
  finalStatus = "COMPLETED"
) {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls < completesOnAttempt) {
      return { status: "ACCEPTED" };
    }
    return { status: "ACCEPTED", finalStatus };
  });
}

/** Builds a checkFn that always returns ACCEPTED (never completes) */
function checkFnNeverCompletes() {
  return vi.fn(async () => ({ status: "ACCEPTED" }));
}

/** Builds a checkFn that throws on each call */
function checkFnAlwaysThrows(msg = "check failed") {
  return vi.fn(async () => { throw new Error(msg); });
}

// ── pollUntilFinal ────────────────────────────────────────────────────────────

describe("pollUntilFinal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves immediately when first response is COMPLETED", async () => {
    const checkFn = vi.fn(async () => ({ status: "ACCEPTED", finalStatus: "COMPLETED" }));
    const promise = pollUntilFinal(checkFn, { maxAttempts: 5, intervalMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.response.finalStatus).toBe("COMPLETED");
    expect(checkFn).toHaveBeenCalledTimes(1);
  });

  it("resolves immediately when first response is FAILED", async () => {
    const checkFn = vi.fn(async () => ({ status: "REJECTED", finalStatus: "FAILED" }));
    const promise = pollUntilFinal(checkFn, { maxAttempts: 5, intervalMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(true);
    expect(result.response.finalStatus).toBe("FAILED");
  });

  it("polls multiple times before reaching COMPLETED", async () => {
    const checkFn = checkFnAfter(4, "COMPLETED");
    const promise = pollUntilFinal(checkFn, { maxAttempts: 10, intervalMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(true);
    expect(result.attempts).toBe(4);
    expect(checkFn).toHaveBeenCalledTimes(4);
  });

  it("returns resolved=false when max attempts exhausted", async () => {
    const checkFn = checkFnNeverCompletes();
    const promise = pollUntilFinal(checkFn, { maxAttempts: 3, intervalMs: 100 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(false);
    expect(result.attempts).toBe(3);
    expect(checkFn).toHaveBeenCalledTimes(3);
  });

  it("uses default maxAttempts of 20 when not specified", async () => {
    const checkFn = checkFnNeverCompletes();
    const promise = pollUntilFinal(checkFn, { intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.attempts).toBe(20);
  });

  it("calls onAttempt callback with attempt number and response", async () => {
    const onAttempt = vi.fn();
    const checkFn = checkFnAfter(3, "COMPLETED");
    const promise = pollUntilFinal(checkFn, {
      maxAttempts: 5,
      intervalMs: 0,
      onAttempt,
    });
    await vi.runAllTimersAsync();
    await promise;
    expect(onAttempt).toHaveBeenCalledTimes(3);
    expect(onAttempt).toHaveBeenCalledWith(1, expect.objectContaining({ status: "ACCEPTED" }));
    expect(onAttempt).toHaveBeenCalledWith(3, expect.objectContaining({ finalStatus: "COMPLETED" }));
  });

  it("throws PawaPayError when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const checkFn = vi.fn(async () => ({ status: "ACCEPTED" }));
    const promise = pollUntilFinal(checkFn, {
      maxAttempts: 5,
      intervalMs: 0,
      signal: controller.signal,
    });
    const assertion1 = expect(promise).rejects.toThrow(PawaPayError);
    const assertion2 = expect(promise).rejects.toThrow(/AbortSignal/);
    await vi.runAllTimersAsync();
    await assertion1;
    await assertion2;
    expect(checkFn).not.toHaveBeenCalled();
  });

  it("throws PawaPayError when signal is aborted mid-poll", async () => {
    const controller = new AbortController();
    let calls = 0;
    const checkFn = vi.fn(async () => {
      calls++;
      if (calls === 2) controller.abort();
      return { status: "ACCEPTED" };
    });
    const promise = pollUntilFinal(checkFn, {
      maxAttempts: 10,
      intervalMs: 0,
      signal: controller.signal,
    });
    const assertion = expect(promise).rejects.toThrow(PawaPayError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("propagates errors thrown by checkFn", async () => {
    const checkFn = checkFnAlwaysThrows("network failure");
    const promise = pollUntilFinal(checkFn, { maxAttempts: 3, intervalMs: 0 });
    const assertion = expect(promise).rejects.toThrow("network failure");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("returns last response when not resolved", async () => {
    const lastResp = { status: "ACCEPTED", depositId: "dep-999" };
    const checkFn = vi.fn(async () => lastResp);
    const promise = pollUntilFinal(checkFn, { maxAttempts: 2, intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.response).toEqual(lastResp);
  });

  it("detects COMPLETED from status field (not finalStatus)", async () => {
    const checkFn = vi.fn(async () => ({ status: "COMPLETED" }));
    const promise = pollUntilFinal(checkFn, { maxAttempts: 5, intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("finalStatus takes precedence over status for detection", async () => {
    const checkFn = vi.fn(async () => ({
      status: "ACCEPTED",
      finalStatus: "COMPLETED",
    }));
    const promise = pollUntilFinal(checkFn, { maxAttempts: 5, intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.resolved).toBe(true);
  });
});

// ── pollUntilFinalOrThrow ─────────────────────────────────────────────────────

describe("pollUntilFinalOrThrow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns response when resolved", async () => {
    const checkFn = vi.fn(async () => ({ status: "ACCEPTED", finalStatus: "COMPLETED" }));
    const promise = pollUntilFinalOrThrow(checkFn, { maxAttempts: 3, intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.finalStatus).toBe("COMPLETED");
  });

  it("throws PawaPayError when max attempts exhausted without final state", async () => {
    const checkFn = checkFnNeverCompletes();
    const promise = pollUntilFinalOrThrow(checkFn, { maxAttempts: 3, intervalMs: 0 });
    const assertion1 = expect(promise).rejects.toThrow(PawaPayError);
    const assertion2 = expect(promise).rejects.toThrow(/final state/);
    await vi.runAllTimersAsync();
    await assertion1;
    await assertion2;
  });

  it("error message includes attempt count", async () => {
    const checkFn = checkFnNeverCompletes();
    const promise = pollUntilFinalOrThrow(checkFn, { maxAttempts: 4, intervalMs: 0 });
    const assertion = expect(promise).rejects.toThrow("4");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("error message includes last known status", async () => {
    const checkFn = vi.fn(async () => ({ status: "ACCEPTED" }));
    const promise = pollUntilFinalOrThrow(checkFn, { maxAttempts: 2, intervalMs: 0 });
    const assertion = expect(promise).rejects.toThrow("ACCEPTED");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("resolves with FAILED status (still a final state)", async () => {
    const checkFn = vi.fn(async () => ({ status: "REJECTED", finalStatus: "FAILED" }));
    const promise = pollUntilFinalOrThrow(checkFn, { maxAttempts: 3, intervalMs: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.finalStatus).toBe("FAILED");
  });
});