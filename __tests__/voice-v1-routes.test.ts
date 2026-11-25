import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireMobileAuth = vi.fn();
const mockGetUserIdFromRequest = vi.fn();
const mockGetAuthenticatedUserId = vi.fn();
const mockBuildVoiceLiveConfig = vi.fn();
const mockBuildVoiceAuthTokenConfig = vi.fn();
const mockAuthTokenCreate = vi.fn();
const mockRecordVoiceSession = vi.fn();
const mockUserGet = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    authTokens = { create: (...args: unknown[]) => mockAuthTokenCreate(...args) };
  },
}));

vi.mock("@/lib/api/v1/guard", () => ({
  requireMobileAuth: (...args: unknown[]) => mockRequireMobileAuth(...args),
}));

vi.mock("@/lib/api/v1/auth", () => ({
  getUserIdFromRequest: (...args: unknown[]) => mockGetUserIdFromRequest(...args),
}));

vi.mock("@/lib/actions/auth", () => ({
  getAuthenticatedUserId: (...args: unknown[]) =>
    mockGetAuthenticatedUserId(...args),
}));

vi.mock("@/lib/voice/live-config", () => ({
  GEMINI_LIVE_MODEL: "gemini-3.8-live",
  buildVoiceLiveConfig: (...args: unknown[]) => mockBuildVoiceLiveConfig(...args),
  buildVoiceAuthTokenConfig: (...args: unknown[]) =>
    mockBuildVoiceAuthTokenConfig(...args),
}));

vi.mock("@/lib/actions/voice-actions", () => ({
  recordVoiceSession: (...args: unknown[]) => mockRecordVoiceSession(...args),
}));

vi.mock("@/firebase/admin", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        get: () => mockUserGet(name, id),
      }),
    }),
  },
}));

import { GET as getToken } from "@/app/api/v1/voice/token/route";
import { POST as postBilling } from "@/app/api/v1/voice/billing/route";
import { POST as postWebBilling } from "@/app/api/voice-billing/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  mockCheckRateLimit.mockResolvedValue({ success: true, remainingAttempts: 19 });
});

describe("GET /api/v1/voice/token", () => {
  it("returns token metadata without creating Firestore voice documents", async () => {
    mockRequireMobileAuth.mockResolvedValue({ userId: "user-1" });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Ada",
        freeVoiceSeconds: 60,
        balance: 100,
        preferedVoice: { preferedVoiceId: "Aoede", preferedVoiceName: "Evelyn" },
      }),
    });
    mockBuildVoiceLiveConfig.mockReturnValue({
      config: { responseModalities: ["AUDIO"] },
      credits: { freeVoiceSeconds: 60, balance: 100, allowedSeconds: 180 },
    });
    mockBuildVoiceAuthTokenConfig.mockReturnValue({ uses: 1 });
    mockAuthTokenCreate.mockResolvedValue({ name: "auth_tokens/ephemeral" });

    const response = await getToken(new Request("https://example.test/api/v1/voice/token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      token: "auth_tokens/ephemeral",
      allowedSeconds: 180,
      model: "gemini-3.8-live",
    });
    expect(typeof body.data.sessionId).toBe("string");
  });

  it("returns 402 when the user has zero allowed seconds", async () => {
    mockRequireMobileAuth.mockResolvedValue({ userId: "user-1" });
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: "Ada", freeVoiceSeconds: 0, balance: 0 }),
    });
    mockBuildVoiceLiveConfig.mockReturnValue({
      config: {},
      credits: { freeVoiceSeconds: 0, balance: 0, allowedSeconds: 0 },
    });

    const response = await getToken(new Request("https://example.test/api/v1/voice/token"));
    expect(response.status).toBe(402);
  });

  it("returns 429 when token rate limit is exceeded", async () => {
    mockRequireMobileAuth.mockResolvedValue({ userId: "user-1" });
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remainingAttempts: 0,
      retryAfterSeconds: 45,
      message: "Too many requests",
    });

    const response = await getToken(new Request("https://example.test/api/v1/voice/token"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
  });
});

describe("POST /api/v1/voice/billing", () => {
  it("returns 404 when recordVoiceSession reports NOT_FOUND", async () => {
    mockGetUserIdFromRequest.mockResolvedValue("user-1");
    mockRecordVoiceSession.mockResolvedValue({
      success: false,
      retryable: false,
      code: "NOT_FOUND",
      error: "voice session buffer belongs to another user",
    });

    const response = await postBilling(
      new Request("https://example.test/api/v1/voice/billing", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess-1", duration: 10, transcripts: [] }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when recordVoiceSession reports ZERO_DURATION", async () => {
    mockGetUserIdFromRequest.mockResolvedValue("user-1");
    mockRecordVoiceSession.mockResolvedValue({
      success: false,
      retryable: false,
      code: "ZERO_DURATION",
      error: "Nothing to bill or summarize.",
    });

    const response = await postBilling(
      new Request("https://example.test/api/v1/voice/billing", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess-empty", duration: 0, transcripts: [] }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("delegates real sessions to recordVoiceSession with web-aligned fields", async () => {
    mockGetUserIdFromRequest.mockResolvedValue("user-1");
    mockRecordVoiceSession.mockResolvedValue({
      success: true,
      voiceSessionId: "sess-real",
    });

    const response = await postBilling(
      new Request("https://example.test/api/v1/voice/billing", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "sess-real",
          duration: 14.9,
          transcripts: [{ role: "user", content: "Hello" }],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ voiceSessionId: "sess-real" });
    expect(mockRecordVoiceSession).toHaveBeenCalledWith({
      usage: expect.objectContaining({
        userId: "user-1",
        sessionId: "sess-real",
        duration: 14,
        transcripts: [{ role: "user", content: "Hello" }],
        title: "",
        summary: "",
        audioUrl: "",
      }),
    });
    const passedUsage = mockRecordVoiceSession.mock.calls[0]?.[0].usage;
    expect(passedUsage).not.toHaveProperty("recordingStatus");
    expect(passedUsage).not.toHaveProperty("reservationType");
    expect(passedUsage).not.toHaveProperty("allowedSeconds");
    expect(passedUsage).not.toHaveProperty("startedAt");
  });
});

describe("POST /api/voice-billing (web)", () => {
  it("returns 404 on ownership mismatch, 400 on ZERO_DURATION, and 200 on success", async () => {
    mockGetAuthenticatedUserId.mockResolvedValue("user-1");

    mockRecordVoiceSession.mockResolvedValueOnce({
      success: false,
      retryable: false,
      code: "NOT_FOUND",
      error: "foreign session",
    });
    const r404 = await postWebBilling(
      new Request("https://example.test/api/voice-billing", {
        method: "POST",
        body: JSON.stringify({ sessionId: "s-1", duration: 10, transcripts: [] }),
      }),
    );
    expect(r404.status).toBe(404);

    mockRecordVoiceSession.mockResolvedValueOnce({
      success: false,
      retryable: false,
      code: "ZERO_DURATION",
      error: "Nothing to bill or summarize.",
    });
    const r400 = await postWebBilling(
      new Request("https://example.test/api/voice-billing", {
        method: "POST",
        body: JSON.stringify({ sessionId: "s-0", duration: 0, transcripts: [] }),
      }),
    );
    expect(r400.status).toBe(400);

    mockRecordVoiceSession.mockResolvedValueOnce({
      success: true,
      voiceSessionId: "s-ok",
    });
    const r200 = await postWebBilling(
      new Request("https://example.test/api/voice-billing", {
        method: "POST",
        body: JSON.stringify({ sessionId: "s-ok", duration: 15, transcripts: [] }),
      }),
    );
    expect(r200.status).toBe(200);
    expect(await r200.json()).toEqual({ success: true, voiceSessionId: "s-ok" });
  });
});
