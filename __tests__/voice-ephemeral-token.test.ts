import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEphemeralToken } from "@/hooks/use-gemini-live/use-ephemeral-token";

vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckToken: vi.fn().mockResolvedValue("test-app-check-token"),
}));

describe("useEphemeralToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("consumes prefetched token on first connect, and fetches fresh token on subsequent connect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-prefetched" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-reconnect" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEphemeralToken());

    // 1. Prefetch in background
    act(() => {
      result.current.prefetchToken(1800, "Aoede", "Evelyn");
    });
    // Let prefetch fetch settle
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2. First connection consumes the prefetched token (no new fetch)
    let token1 = "";
    await act(async () => {
      token1 = await result.current.getEphemeralToken(false, 1800, "Aoede", "Evelyn");
    });
    expect(token1).toBe("token-prefetched");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 3. Second connection / reconnect: prefetched token was consumed, so it MUST fetch a fresh token
    let token2 = "";
    await act(async () => {
      token2 = await result.current.getEphemeralToken(false, 1800, "Aoede", "Evelyn");
    });
    expect(token2).toBe("token-reconnect");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("consumes in-flight prefetch if connect is triggered before prefetch finishes", async () => {
    let resolveFetch: (val: unknown) => void = () => {};
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEphemeralToken());

    // Start prefetch
    act(() => {
      result.current.prefetchToken(1800, "Aoede", "Evelyn");
    });

    // Immediate connect while prefetch is in-flight
    let connectPromise: Promise<string>;
    act(() => {
      connectPromise = result.current.getEphemeralToken(false, 1800, "Aoede", "Evelyn");
    });

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ token: "token-inflight" }),
      });
      const token = await connectPromise;
      expect(token).toBe("token-inflight");
    });

    // Only 1 fetch was made
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse in-flight promise if the voice parameter changes", async () => {
    let resolveFirstFetch: (val: unknown) => void = () => {};
    const firstPromise = new Promise((resolve) => {
      resolveFirstFetch = resolve;
    });

    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "voice-puck-token" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEphemeralToken());

    let p1: Promise<string>;
    let p2: Promise<string>;
    act(() => {
      // First request with Aoede
      p1 = result.current.getEphemeralToken(false, 1800, "Aoede", "Evelyn");
      // Second request immediately with Puck
      p2 = result.current.getEphemeralToken(false, 1800, "Puck", "Liam");
    });

    await act(async () => {
      resolveFirstFetch({
        ok: true,
        json: async () => ({ token: "voice-aoede-token" }),
      });
      const [t1, t2] = await Promise.all([p1, p2]);
      expect(t1).toBe("voice-aoede-token");
      expect(t2).toBe("voice-puck-token");
    });

    // Two distinct network requests should have been fired
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears cached token when clearCachedToken is called", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-prefetched" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-new" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEphemeralToken());

    // Prefetch token
    act(() => {
      result.current.prefetchToken(1800, "Aoede", "Evelyn");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Clear cache before connect
    act(() => {
      result.current.clearCachedToken();
    });

    let token = "";
    await act(async () => {
      token = await result.current.getEphemeralToken(false, 1800, "Aoede", "Evelyn");
    });
    expect(token).toBe("token-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses prefetched token when forceRefresh is true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-prefetched" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "token-forced" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEphemeralToken());

    // Prefetch token
    act(() => {
      result.current.prefetchToken(1800, "Aoede", "Evelyn");
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Call with forceRefresh = true
    let token = "";
    await act(async () => {
      token = await result.current.getEphemeralToken(true, 1800, "Aoede", "Evelyn");
    });
    expect(token).toBe("token-forced");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
