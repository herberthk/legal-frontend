import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifyAppCheckHeader = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockAuthTokenCreate = vi.fn();

vi.mock("@/lib/app-check-server", () => ({
  verifyAppCheckHeader: (...args: unknown[]) =>
    mockVerifyAppCheckHeader(...args),
}));

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    authTokens = {
      create: (...args: unknown[]) => mockAuthTokenCreate(...args),
    };
  },
  Modality: { AUDIO: "AUDIO" },
  StartSensitivity: { START_SENSITIVITY_LOW: "START_SENSITIVITY_LOW" },
  EndSensitivity: { END_SENSITIVITY_LOW: "END_SENSITIVITY_LOW" },
  ActivityHandling: {
    START_OF_ACTIVITY_INTERRUPTS: "START_OF_ACTIVITY_INTERRUPTS",
  },
  TurnCoverage: { TURN_INCLUDES_ONLY_ACTIVITY: "TURN_INCLUDES_ONLY_ACTIVITY" },
}));

import { GET } from "@/app/api/gemini-token/route";

describe("GET /api/gemini-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    mockVerifyAppCheckHeader.mockResolvedValue({ valid: true });
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      remainingAttempts: 19,
    });
    mockAuthTokenCreate.mockResolvedValue({
      name: "auth_tokens/web-ephemeral",
    });
  });

  it("returns 401 when App Check verification fails", async () => {
    mockVerifyAppCheckHeader.mockResolvedValueOnce({
      valid: false,
      error: "Invalid App Check token",
    });
    mockGetCurrentUser.mockResolvedValueOnce({ id: "user-1", name: "Ada" });

    const res = await GET(new Request("https://example.test/api/gemini-token"));
    expect(res.status).toBe(401);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const res = await GET(new Request("https://example.test/api/gemini-token"));
    expect(res.status).toBe(401);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when per-UID rate limit is exceeded", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      name: "Ada",
      freeVoiceSeconds: 120,
      balance: 0,
    });
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remainingAttempts: 0,
      retryAfterSeconds: 42,
      message: "Too many requests",
    });

    const res = await GET(new Request("https://example.test/api/gemini-token"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockAuthTokenCreate).not.toHaveBeenCalled();
  });

  it("returns 402 when user has zero voice credits", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      name: "Ada",
      freeVoiceSeconds: 0,
      balance: 0,
    });

    const res = await GET(new Request("https://example.test/api/gemini-token"));
    expect(res.status).toBe(402);
    expect(mockAuthTokenCreate).not.toHaveBeenCalled();
  });

  it("mints a token successfully even when user.name is missing", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      name: undefined,
      freeVoiceSeconds: 120,
      balance: 0,
    });

    const res = await GET(
      new Request(
        "https://example.test/api/gemini-token?voiceId=Kore&voiceName=Ashley&maxSecs=90",
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ token: "auth_tokens/web-ephemeral" });
    expect(mockAuthTokenCreate).toHaveBeenCalledTimes(1);
    const passedConfig = mockAuthTokenCreate.mock.calls[0]?.[0]?.config;
    expect(passedConfig.lockAdditionalFields).toEqual([]);
    expect(
      JSON.stringify(passedConfig.liveConnectConstraints.config.systemInstruction),
    ).toContain("live voice call with User");
  });
});
