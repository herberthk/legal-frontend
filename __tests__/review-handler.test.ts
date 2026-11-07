import { afterEach, describe, expect, it, vi } from "vitest";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { checkUserCanSend } from "@/lib/actions/usage";
import { handleReviewRequest } from "@/lib/api/handlers/review";

vi.mock("@/lib/actions/usage", () => ({
  checkUserCanSend: vi.fn(),
  recordUsageAndDeduct: vi.fn(),
}));
vi.mock("@/lib/actions/vertex", () => ({ vertex: vi.fn() }));
vi.mock("@/lib/document-extractor", () => ({ extractDocumentText: vi.fn() }));
vi.mock("@/lib/security/sanitizer", () => ({}));
vi.mock("sharp", () => ({ default: vi.fn() }));

const apiError = (statusCode: number | undefined, message = "Provider failure") =>
  new APICallError({ message, statusCode, url: "https://example.test", requestBodyValues: {} });
const objectError = (finishReason: "stop" | "content-filter") =>
  new NoObjectGeneratedError({
    message: "Document says quota 429, blocked, safety, AbortError, timed out",
    finishReason,
    response: { id: "test", timestamp: new Date(0), modelId: "test" },
    usage: {
      inputTokens: 0, outputTokens: 0, totalTokens: 0,
      inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
    },
  });
const retryError = (lastError: unknown) => new RetryError({
  message: "Earlier attempt returned 429", reason: "maxRetriesExceeded",
  errors: [apiError(429), lastError],
});

afterEach(() => vi.restoreAllMocks());

describe("review error classification", () => {
  it.each([
    [apiError(429), 429, "capacity or quota"],
    [apiError(503, "quota 429 blocked"), 503, "temporarily busy"],
    [retryError(apiError(503)), 503, "temporarily busy"],
    [objectError("content-filter"), 422, "safety filters"],
    [Object.assign(new Error("quota 429 blocked"), { name: "AbortError" }), 504, "timed out"],
    [new DOMException("unrelated", "TimeoutError"), 504, "timed out"],
    [retryError(new DOMException("unrelated", "AbortError")), 504, "timed out"],
    [new Error("RESOURCE_EXHAUSTED"), 429, "capacity or quota"],
    [new Error("UNAVAILABLE"), 503, "temporarily busy"],
    [new Error("DEADLINE_EXCEEDED"), 504, "timed out"],
    [apiError(400, "quota 429 503 safety blocked timed out"), 500, "unexpected server error"],
    [apiError(undefined, "RESOURCE_EXHAUSTED"), 500, "unexpected server error"],
    [objectError("stop"), 500, "unexpected server error"],
    [new Error("Document 429 mentions quota 503 UNAVAILABLE overloaded safety blocked HARM_CATEGORY AbortError deadline timed out TIMEOUT"), 500, "unexpected server error"],
    ["quota 429", 500, "unexpected server error"],
    [null, 500, "unexpected server error"],
  ])("classifies %s as %s", async (error, status, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Every failure reaches the same outer catch, independently of its source.
    vi.mocked(checkUserCanSend).mockRejectedValueOnce(error);
    const response = await handleReviewRequest(new Request("http://localhost/api/review"), "user");
    expect(response.status).toBe(status);
    expect((await response.json()).error).toContain(message);
  });
});
