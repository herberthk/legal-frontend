// tests/http.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenManager, apiRequest, FlwUgSdkError } from "../";
import {
  VALID_TOKEN_RESPONSE,
  mockFetchSequence,
  mockFetchError,
  mockFetchAbort,
} from "./helpers.js";

const TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
const API_URL   = "https://developersandbox-api.flutterwave.com/charges/chg_001";

// ─────────────────────────────────────────────────────────────────────────────
// TokenManager
// ─────────────────────────────────────────────────────────────────────────────

describe("TokenManager", () => {
  beforeEach(() => { vi.stubGlobal("fetch", undefined); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetches a token on first getToken() call", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_TOKEN_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("id", "secret", 5_000);
    const token = await tm.getToken();

    expect(token).toBe(VALID_TOKEN_RESPONSE.access_token);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(TOKEN_URL);
  });

  it("caches the token and does NOT re-fetch on second call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(VALID_TOKEN_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("id", "secret", 5_000);
    await tm.getToken();
    await tm.getToken();

    // Only one fetch despite two getToken() calls
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refreshes the token when it is near expiry (< 60 s remaining)", async () => {
    // Return a token that expires in 62 s (62 - 5 buffer = 57 s effective TTL, within 60 s threshold)
    const makeTokenResponse = () =>
      new Response(
        JSON.stringify({ ...VALID_TOKEN_RESPONSE, expires_in: 62 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => makeTokenResponse())
      .mockImplementationOnce(async () => makeTokenResponse());
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("id", "secret", 5_000);

    // First call — fetches and caches token (expires in ~57 s)
    await tm.getToken();
    expect(fetchMock).toHaveBeenCalledOnce();

    // Fast-forward past the 60 s refresh threshold
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 58_000);

    // Second call — within threshold, must refresh
    await tm.getToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("de-duplicates concurrent getToken() calls into a single fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(VALID_TOKEN_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("id", "secret", 5_000);

    // Fire three simultaneous calls
    const [t1, t2, t3] = await Promise.all([tm.getToken(), tm.getToken(), tm.getToken()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(t1).toBe(t2);
    expect(t2).toBe(t3);
  });

  it("throws TOKEN_FETCH_FAILED on HTTP 401", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("bad-id", "bad-secret", 5_000);
    await expect(tm.getToken()).rejects.toMatchObject({
      sdkError: { code: "TOKEN_FETCH_FAILED", httpStatus: 401 },
    });
  });

  it("throws TIMEOUT when token fetch times out", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("id", "secret", 100);
    await expect(tm.getToken()).rejects.toMatchObject({
      sdkError: { code: "TIMEOUT" },
    });
  });

  it("uses client_credentials grant in the POST body", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(VALID_TOKEN_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const tm = new TokenManager("my-client-id", "my-secret", 5_000);
    await tm.getToken();

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("my-client-id");
    expect(body.get("client_secret")).toBe("my-secret");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// apiRequest
// ─────────────────────────────────────────────────────────────────────────────

describe("apiRequest", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function makeTm(token = "tok_abc"): TokenManager {
    // Return a TokenManager that instantly returns a fake token without fetching
    const tm = new TokenManager("id", "secret", 5_000);
    vi.spyOn(tm, "getToken").mockResolvedValue(token);
    return tm;
  }

  it("makes a GET request with Authorization header", async () => {
    const payload = { id: "chg_001" };
    vi.stubGlobal("fetch", mockFetchSequence(payload));

    const tm = makeTm("tok_123");
    const result = await apiRequest<typeof payload>("GET", API_URL, tm);

    expect(result).toEqual(payload);
 //@ts-ignore
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok_123");
    expect(init.method).toBe("GET");
  });

  it("attaches X-Idempotency-Key on POST but not GET", async () => {
    vi.stubGlobal("fetch", mockFetchSequence({ ok: true }));
    const tm = makeTm();
    await apiRequest("POST", API_URL, tm, { foo: "bar" });
 //@ts-ignore
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["X-Idempotency-Key"]).toBeTruthy();

    vi.stubGlobal("fetch", mockFetchSequence({ ok: true }));
    await apiRequest("GET", API_URL, makeTm());
     //@ts-ignore
    const [, getInit] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(getInit.headers["X-Idempotency-Key"]).toBeUndefined();
  });

  it("attaches X-Trace-Id on every request", async () => {
    vi.stubGlobal("fetch", mockFetchSequence({ ok: true }));
    const tm = makeTm();
    await apiRequest("GET", API_URL, tm);
 //@ts-ignore
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["X-Trace-Id"]).toBeTruthy();
  });

  it("serialises body as JSON on POST", async () => {
    const body = { amount: 10_000, currency: "UGX" };
    vi.stubGlobal("fetch", mockFetchSequence({ id: "chg_001" }));
    const tm = makeTm();
    await apiRequest("POST", API_URL, tm, body);
 //@ts-ignore
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("throws API_ERROR with correct message on HTTP 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "error", message: "Validation failed", error: { message: "Invalid phone", type: "e", code: "400" } }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const tm = makeTm();
    await expect(apiRequest("POST", API_URL, tm, {})).rejects.toMatchObject({
      sdkError: { code: "API_ERROR", message: "Invalid phone", httpStatus: 422 },
    });
  });

  it("throws API_ERROR when response body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("not-json", { status: 200, headers: { "Content-Type": "text/html" } })
      )
    );
    const tm = makeTm();
    await expect(apiRequest("GET", API_URL, tm)).rejects.toMatchObject({
      sdkError: { code: "API_ERROR" },
    });
  });

  it("throws TIMEOUT when request signal aborts", async () => {
    vi.stubGlobal("fetch", mockFetchAbort());
    const tm = makeTm();
    await expect(apiRequest("GET", API_URL, tm, undefined, 100)).rejects.toMatchObject({
      sdkError: { code: "TIMEOUT" },
    });
  });

  it("throws API_ERROR on generic network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"))
    );
    const tm = makeTm();
    await expect(apiRequest("GET", API_URL, tm)).rejects.toMatchObject({
      sdkError: { code: "API_ERROR", message: expect.stringContaining("Network error") },
    });
  });

  it("throws API_ERROR when response status is 'failed'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "failed", message: "Charge failed" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const tm = makeTm();
    await expect(apiRequest("POST", API_URL, tm, {})).rejects.toMatchObject({
      sdkError: { code: "API_ERROR", message: "Charge failed" },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FlwUgSdkError
// ─────────────────────────────────────────────────────────────────────────────

describe("FlwUgSdkError", () => {
  it("is an instance of Error", () => {
    const err = new FlwUgSdkError({ code: "API_ERROR", message: "oops" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FlwUgSdkError);
  });

  it("sets name to FlwUgSdkError", () => {
    const err = new FlwUgSdkError({ code: "TIMEOUT", message: "timed out" });
    expect(err.name).toBe("FlwUgSdkError");
  });

  it("exposes sdkError with code and message", () => {
    const err = new FlwUgSdkError({ code: "INVALID_PHONE", message: "bad phone", httpStatus: 400 });
    expect(err.sdkError.code).toBe("INVALID_PHONE");
    expect(err.sdkError.message).toBe("bad phone");
    expect(err.sdkError.httpStatus).toBe(400);
  });

  it("message matches sdkError.message", () => {
    const err = new FlwUgSdkError({ code: "API_ERROR", message: "test msg" });
    expect(err.message).toBe("test msg");
  });
});
