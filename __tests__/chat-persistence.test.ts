import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyChatSessionOwner } from "@/lib/api/v1/ownership";
import { saveChatMessage } from "@/lib/actions/chat";
import { handleChatRequest } from "@/lib/api/handlers/chat";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), set: vi.fn(), update: vi.fn(), transaction: vi.fn(),
  stream: vi.fn(), usage: vi.fn(), credits: vi.fn(),
}));
vi.mock("@/firebase/admin", () => {
  const doc = { get: mocks.get, id: "message", collection: () => ({ doc: () => doc }) };
  return { db: { collection: () => ({ doc: () => doc }), runTransaction: mocks.transaction }, storageAdmin: {} };
});
vi.mock("@/lib/actions/usage", () => ({ checkUserCanSend: mocks.credits, recordUsageAndDeduct: mocks.usage }));
vi.mock("@/lib/actions/vertex", () => ({ vertex: vi.fn() }));
vi.mock("@/lib/document-extractor", () => ({ extractDocumentText: vi.fn() }));
vi.mock("ai", () => ({
  streamText: mocks.stream, convertToModelMessages: vi.fn().mockResolvedValue([]),
  smoothStream: vi.fn(), toUIMessageStream: vi.fn(),
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: () => new Response(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.get.mockResolvedValue({ exists: true, data: () => ({ userId: "user" }) });
  mocks.transaction.mockImplementation(async (callback) => callback({ set: mocks.set, update: mocks.update }));
  mocks.credits.mockResolvedValue({ canSend: true, user: { freeTextTokens: 100000 } });
  mocks.stream.mockReturnValue({ stream: {} });
});
const request = () => new Request("http://localhost/api/chat", {
  method: "POST", headers: { "x-chat-id": "session" },
  body: JSON.stringify({ messages: [{ role: "user", parts: [{ type: "text", text: "Hello" }] }] }),
});

describe("chat ownership", () => {
  it.each([false, true])("rejects missing or foreign sessions (exists=%s)", async (exists) => {
    mocks.get.mockResolvedValue({ exists, data: () => ({ userId: "other" }) });
    expect(await verifyChatSessionOwner("session", "user")).toBe(false);
    expect((await handleChatRequest(request(), "user")).status).toBe(403);
  });
  it("accepts the owner", async () => {
    expect(await verifyChatSessionOwner("session", "user")).toBe(true);
  });
  it("propagates lookup failures and responds with a server error", async () => {
    const error = new Error("unavailable");
    mocks.get.mockRejectedValue(error);
    await expect(verifyChatSessionOwner("session", "user")).rejects.toBe(error);
    expect((await handleChatRequest(request(), "user")).status).toBe(500);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});

describe("chat persistence", () => {
  it.each([true, false])("updates metadata with the existing title condition (first=%s)", async (isFirstMessage) => {
    expect(await saveChatMessage("session", { role: "user", text: "Hello", tokenCount: 1, isFirstMessage })).toMatchObject({ success: true });
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      updatedAt: expect.anything(), messageCount: expect.anything(),
    }));
    expect(mocks.update.mock.calls[0][1].title).toBe(isFirstMessage ? "Hello" : undefined);
    expect(mocks.update.mock.calls[0]).toHaveLength(2);
  });
  it("reports failure when the session update fails", async () => {
    mocks.update.mockImplementation(() => { throw new Error("NOT_FOUND"); });
    expect(await saveChatMessage("session", { role: "assistant", text: "Hello", tokenCount: 1 })).toEqual({ success: false, messageId: null });
  });
  it.each(["", "Answer"])("persists user content and only nonempty assistant text (%s)", async (text) => {
    expect((await handleChatRequest(request(), "user")).status).toBe(200);
    await mocks.stream.mock.calls[0][0].onEnd({ text, usage: { outputTokens: 1 } });
    expect(mocks.set.mock.calls.map((call) => call[1].role)).toEqual(text ? ["user", "assistant"] : ["user"]);
    expect(mocks.update).toHaveBeenCalledTimes(text ? 2 : 1);
  });
});
