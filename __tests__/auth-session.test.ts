import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/auth/session/route";
import * as authActions from "@/lib/actions/auth";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  set: vi.fn(),
  collection: vi.fn(),
  checkRateLimit: vi.fn(),
  verifyAppCheckHeader: vi.fn(),
  verifyIdToken: vi.fn(),
  verifySessionCookie: vi.fn(),
  getCookie: vi.fn(),
}));

vi.mock("@/firebase/admin", () => ({
  auth: {
    verifyIdToken: mocks.verifyIdToken,
    verifySessionCookie: mocks.verifySessionCookie,
  },
  db: { collection: mocks.collection },
}));
vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: vi.fn(),
}));
vi.mock("@/lib/app-check-server", () => ({
  verifyAppCheckHeader: mocks.verifyAppCheckHeader,
}));
vi.mock("@/lib/actions/email", () => ({ sendOtp: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.getCookie }),
  headers: async () => new Headers(),
}));

const webStats = {
  browser: "Firefox",
  os: "Linux",
  device: "Desktop",
  deviceName: "Test device",
  resolution: "1920x1080",
  timezone: "UTC",
  userAgent: "Test browser",
};

function mobileRequest(body: unknown = {}, token = "test-id-token") {
  return new Request("https://example.test/api/v1/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-firebase-appcheck": "test-app-check-token",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.collection.mockReturnValue({
    add: mocks.add,
    doc: () => ({ set: mocks.set }),
  });
  mocks.add.mockResolvedValue({ id: "session-id" });
  mocks.set.mockResolvedValue(undefined);
  mocks.checkRateLimit.mockResolvedValue({ success: true });
  mocks.verifyAppCheckHeader.mockResolvedValue({ valid: true });
  mocks.verifyIdToken.mockResolvedValue({ uid: "verified-mobile-user" });
  mocks.verifySessionCookie.mockResolvedValue({ uid: "verified-web-user" });
  mocks.getCookie.mockReturnValue({ value: "test-session-cookie" });
});

describe("mobile session recording", () => {
  it("records only the identity from the verified token and returns the success envelope", async () => {
    const response = await POST(mobileRequest({ userId: "other-user" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { success: true } });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith("test-id-token", true);
    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "verified-mobile-user" }),
    );
    expect(mocks.set).toHaveBeenCalledOnce();
  });

  it("rejects failed App Check before verifying the token or recording", async () => {
    mocks.verifyAppCheckHeader.mockResolvedValue({ valid: false });

    const response = await POST(mobileRequest());

    expect(response.status).toBe(401);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it.each(["", "invalid-token"])("rejects a missing or invalid Bearer token (%s)", async (token) => {
    mocks.verifyIdToken.mockRejectedValue(new Error("Invalid token"));

    const response = await POST(mobileRequest({}, token));

    expect(response.status).toBe(401);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("returns HTTP 429 without recording when the rate limit is reached", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false });

    const response = await POST(mobileRequest());

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Rate limit exceeded" },
    });
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it.each(["add", "set"] as const)("returns HTTP 500 when the Firestore %s fails", async (write) => {
    mocks[write].mockRejectedValue(new Error("Firestore unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(mobileRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: "INTERNAL", message: "Failed to record session." },
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  it("rejects coordinates outside the valid range before recording", async () => {
    const response = await POST(mobileRequest({
      coordinates: { latitude: 90.001, longitude: 0 },
    }));

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.collection).not.toHaveBeenCalled();
  });
});

describe("web session recording", () => {
  it("does not export the shared recorder as a Server Action", () => {
    expect(authActions).not.toHaveProperty("recordUserSession");
  });

  it.each(["missing", "invalid"])("rejects a %s session cookie before recording", async (state) => {
    if (state === "missing") mocks.getCookie.mockReturnValue(undefined);
    else mocks.verifySessionCookie.mockRejectedValue(new Error("Invalid cookie"));

    expect(await authActions.recordUserStats(webStats)).toEqual({ success: false });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("keeps verified identity and server metadata when extra runtime fields are supplied", async () => {
    const untrustedStats = {
      ...webStats,
      userId: "other-user",
      ip: "spoofed-ip",
      country: "spoofed-country",
      city: "spoofed-city",
    };

    expect(await authActions.recordUserStats(untrustedStats)).toEqual({ success: true });
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith("test-session-cookie", true);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "verified-web-user" }));
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({
      userId: "verified-web-user", ip: "Unknown", country: "Unknown", city: "Unknown",
    }));
    expect(mocks.add.mock.calls[0][0]).not.toHaveProperty("coordinates");
  });

  it.each([
    { latitude: NaN, longitude: 0 },
    { latitude: Infinity, longitude: 0 },
    { latitude: -Infinity, longitude: 0 },
    { latitude: 0, longitude: NaN },
    { latitude: 0, longitude: Infinity },
    { latitude: 0, longitude: -Infinity },
    { latitude: 90.001, longitude: 0 },
    { latitude: -90.001, longitude: 0 },
    { latitude: 0, longitude: 180.001 },
    { latitude: 0, longitude: -180.001 },
    { latitude: "0", longitude: 0 },
    { latitude: 0, longitude: "0" },
  ])("omits invalid runtime coordinates: %j", async (coordinates) => {
    await authActions.recordUserStats({
      ...webStats,
      coordinates: coordinates as unknown as NonNullable<UserStats["coordinates"]>,
    });

    expect(mocks.add).toHaveBeenCalledOnce();
    expect(mocks.add.mock.calls[0][0]).not.toHaveProperty("coordinates");
  });

  it.each([
    [90, 180, undefined, 90, 180],
    [-90, -180, undefined, -90, -180],
    [0, 0, undefined, 0, 0],
    [0.3476, 32.5825, 15, 0.348, 32.583],
  ] as const)("records valid coordinates with reduced precision (%s, %s)", async (
    latitude, longitude, accuracy, expectedLatitude, expectedLongitude,
  ) => {
    await authActions.recordUserStats({
      ...webStats,
      coordinates: { latitude, longitude, accuracy },
    });

    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({
      coordinates: {
        latitude: expectedLatitude,
        longitude: expectedLongitude,
        accuracy: accuracy ?? null,
      },
    }));
  });
});
