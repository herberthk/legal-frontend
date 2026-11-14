/**
 * One turn against the server.
 *
 * The three routes that matter here are the pre-generation `POST /chats` (which
 * may create the pending question together with the session), the streaming
 * `POST /api/v1/chat` (which replays a stored answer, persists a finished one,
 * and bills it at most once) and `DELETE /chats/:id/turns/:turnId` (which drops a
 * pending turn).
 *
 * The Firestore double models document ids, because the outbox distinguishes
 * documents by their id (`{turnId}` vs `{turnId}-a`) rather than by a field.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUIMessageStream, toUIMessageStream } from "ai";

import { POST as createPost } from "@/app/api/v1/chats/route";
import { DELETE } from "@/app/api/v1/chats/[id]/turns/[turnId]/route";
import { POST as chatPost } from "@/app/api/v1/chat/route";
import {
  beginChatTurn,
  cancelChatTurn,
  completeChatTurn,
  createChatSessionWithTurn,
} from "@/lib/actions/chat-turn";
import { handleChatRequest } from "@/lib/api/handlers/chat";

type Snapshot = { exists: boolean; data: Record<string, unknown> };

const SESSION_ID = "session";
const TURN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function session(userId: string) {
  return { exists: true, data: { userId, title: "Chat", messageCount: 0 } };
}

function pendingTurn() {
  return { exists: true, data: { role: "user", text: "Hello", tokenCount: 0 } };
}

function storedAnswer(text: string) {
  return {
    exists: true,
    data: { role: "assistant", text, tokenCount: 3 },
  };
}

const mocks = vi.hoisted(() => ({
  docs: new Map<string, { exists: boolean; data: Record<string, unknown> }>(),
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  batchCommit: vi.fn(),
  transaction: vi.fn(),
  stream: vi.fn(),
  usage: vi.fn(),
  credits: vi.fn(),
  appCheck: vi.fn(),
  authUser: vi.fn(),
}));

vi.mock("@/lib/api/v1/guard", () => ({
  requireMobileAuth: async () => ({ userId: "user" }),
}));

vi.mock("@/lib/app-check-server", () => ({
  verifyAppCheckHeader: mocks.appCheck,
}));

vi.mock("@/lib/api/v1/auth", () => ({
  getUserIdFromRequest: mocks.authUser,
}));

vi.mock("@/lib/api/v1/ownership", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/v1/ownership")>(
      "@/lib/api/v1/ownership",
    );
  return {
    ...actual,
    // The real helper reads the session document through a different double
    // than the turn actions use; this one reads the same map, so a session set
    // up by a test is the session the turn sees.
    verifyChatSessionOwner: async (sessionId: string, userId: string) => {
      const data = mocks.docs.get(sessionId)?.data as
        | { userId?: string }
        | undefined;
      return data?.userId === userId;
    },
  };
});

vi.mock("@/firebase/admin", () => {
  // The Admin SDK's `data()` is a method; the double keeps the same shape so
  // `session.data()?.userId` reads the way it does in production.
  const snapshot = (id: string) => ({
    exists: mocks.docs.has(id),
    data: () => {
      mocks.get(id);
      return mocks.docs.get(id)?.data;
    },
  });

  const messageRef = (id: string) => ({
    id,
    get: () => Promise.resolve(snapshot(id)),
    set: (data: Record<string, unknown>, options?: unknown) => {
      if (options === undefined) mocks.set(id, data);
      else mocks.set(id, data, options);
      mocks.docs.set(id, { exists: true, data: options ? { ...mocks.docs.get(id)?.data, ...data } : data });
    },
    update: (data: Record<string, unknown>) => { mocks.update(id, data); mocks.docs.set(id, { exists: true, data: { ...mocks.docs.get(id)?.data, ...data } }); },
    delete: () => {
      mocks.delete(id);
      mocks.docs.delete(id);
    },
  });

  const sessionRef = {
    get: () => Promise.resolve(snapshot(SESSION_ID)),
    set: (data: Record<string, unknown>, options?: unknown) => {
      if (options === undefined) mocks.set(SESSION_ID, data);
      else mocks.set(SESSION_ID, data, options);
      mocks.docs.set(SESSION_ID, { exists: true, data });
    },
    update: (data: Record<string, unknown>) => mocks.update(SESSION_ID, data),
    collection: (name: string) => ({ doc: (id?: string) => messageRef(name === "turnCancellations" ? `cancel-${id}` : id ?? "auto") }),
  };

  return {
    db: {
      collection: () => ({ doc: () => sessionRef }),
      batch: () => ({ set: mocks.set, commit: mocks.batchCommit }),
      runTransaction: mocks.transaction,
    },
    storageAdmin: {},
  };
});
vi.mock("@/lib/actions/usage", () => ({
  checkUserCanSend: mocks.credits,
  recordUsageAndDeduct: mocks.usage,
}));
vi.mock("@/lib/actions/vertex", () => ({ vertex: vi.fn() }));
vi.mock("@/lib/document-extractor", () => ({ extractDocumentText: vi.fn() }));
vi.mock("@/lib/security/sanitizer", () => ({
  sanitizeChatContent: (text: string) => text,
  sanitizeFilename: (name: string) => name,
  sanitizeUntrustedDocumentText: (text: string) => ({
    sanitizedText: text,
    hasInjectionAttempt: false,
    detectedThreats: [],
  }),
  wrapDocumentForModel: (text: string) => text,
}));
vi.mock("ai", () => ({
  streamText: mocks.stream,
  convertToModelMessages: vi.fn().mockResolvedValue([]),
  smoothStream: vi.fn(),
  toUIMessageStream: vi.fn(() => ({ onFinish: undefined })),
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: () => new Response("stream"),
}));

function tx() {
  return {
    get: (ref: { get: () => Promise<Snapshot> }) => ref.get(),
    set: (
      ref: { set: (data: Record<string, unknown>, options?: unknown) => void },
      data: Record<string, unknown>,
      options?: unknown,
    ) => ref.set(data, options),
    update: (ref: { update: (data: Record<string, unknown>) => void }, data: Record<string, unknown>) => ref.update(data),
    delete: (ref: { delete: () => void }) => ref.delete(),
  };
}

function chatRequest(
  turnId?: string,
  options?: { url?: string; text?: string; firstMessage?: boolean },
): Request {
  const headers: Record<string, string> = {
    "x-chat-id": SESSION_ID,
    "x-first-message": options?.firstMessage === false ? "false" : "true",
  };
  if (turnId) headers["x-turn-id"] = turnId;
  const parts: unknown[] = [
    { type: "text", text: options?.text ?? "Hello" },
  ];
  if (options?.url) {
    parts.push({
      type: "file",
      mediaType: "application/pdf",
      filename: "lease.pdf",
      url: options.url,
    });
  }
  return new Request("http://localhost/api/v1/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ id: turnId ?? "local", role: "user", parts }],
    }),
  });
}

/** The numeric operand inside `FieldValue.increment(n)`. */
function incrementOperand(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const operand = (value as { operand?: unknown }).operand;
  return typeof operand === "number" ? operand : null;
}

function messageCountIncrement(callIndex = -1): number | null {
  const calls = mocks.update.mock.calls as [string, Record<string, unknown>][];
  const call = calls.at(callIndex);
  return call ? incrementOperand(call[1].messageCount) : null;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.docs.clear();
  mocks.docs.set(SESSION_ID, session("user"));
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(tx()),
  );
  mocks.credits.mockResolvedValue({ canSend: true, user: { freeTextTokens: 100_000 } });
  mocks.usage.mockResolvedValue({ success: true, cost: 0 });
  mocks.stream.mockReturnValue({ stream: {}, usage: Promise.resolve({ outputTokens: 5 }) });
  mocks.appCheck.mockResolvedValue({ valid: true });
  mocks.authUser.mockResolvedValue("user");
});

describe("turn outbox", () => {
  it("keeps the web path free of any turn write", async () => {
    expect((await handleChatRequest(chatRequest(), "user")).status).toBe(200);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates the session and its pending turn in one batch", async () => {
    const result = await createChatSessionWithTurn("user", "Title", {
      turnId: TURN,
      text: "Hello",
      tokenCount: 0,
      isFirstMessage: true,
    });

    expect(result.success).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ messageCount: 1 }),
    );
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
  });

  it("creates the pending row for a follow-up turn", async () => {
    const response = await handleChatRequest(
      chatRequest(TURN, { firstMessage: false }),
      "user",
    );

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(
      TURN,
      expect.objectContaining({
        role: "user",
        text: "Hello",
        createdAt: expect.anything(),
      }),
    );
    // The question is one document; the answer adds the second half later.
    expect(messageCountIncrement(0)).toBe(1);
    expect(mocks.stream).toHaveBeenCalled();
  });

  it("treats a missing first-turn row as a discard", async () => {
    const response = await handleChatRequest(chatRequest(TURN), "user");

    expect(response.status).toBe(410);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("updates the estimated token count on the existing pending row", async () => {
    mocks.docs.set(TURN, pendingTurn());

    await handleChatRequest(chatRequest(TURN), "user");

    expect(mocks.update).toHaveBeenCalledWith(TURN, { tokenCount: 2 });
  });

  it("reports a discarded turn without generating", async () => {
    const response = await handleChatRequest(chatRequest(TURN), "user");

    expect(response.status).toBe(410);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("refuses a foreign session before anything else", async () => {
    mocks.docs.set(SESSION_ID, {
      exists: true,
      data: { userId: "someone-else", title: "Chat" },
    });

    expect((await handleChatRequest(chatRequest(TURN), "user")).status).toBe(403);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("replays a stored answer and settles it idempotently", async () => {
    mocks.docs.set(TURN, pendingTurn());
    mocks.docs.set(`${TURN}-a`, storedAnswer("The answer."));

    const response = await handleChatRequest(chatRequest(TURN), "user");

    expect(response.status).toBe(200);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.usage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user",
        sessionId: SESSION_ID,
        tokens: 3,
        idempotencyKey: TURN,
      }),
    );
  });

  it("does not generate when the account cannot pay", async () => {
    mocks.docs.set(TURN, pendingTurn());
    mocks.credits.mockResolvedValue({
      canSend: false,
      reason: "Insufficient funds or free tokens. Please add funds to continue.",
    });

    const response = await handleChatRequest(chatRequest(TURN), "user");

    expect(response.status).toBe(402);
    expect(mocks.stream).not.toHaveBeenCalled();
    // The pending row survives so the question can be continued after a top-up.
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("refuses an attachment outside the chat prefix", async () => {
    mocks.docs.set(TURN, pendingTurn());
    mocks.docs.set(SESSION_ID, session("user"));

    const response = await handleChatRequest(
      chatRequest(TURN, {
        url: "https://firebasestorage.googleapis.com/v0/b/b/o/storedFiles%2Freviews%2Fscan.pdf",
      }),
      "user",
    );

    expect(response.status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("refuses another user's attachment even inside the prefix", async () => {
    mocks.docs.set(TURN, pendingTurn());
    mocks.docs.set(SESSION_ID, session("user"));

    const response = await handleChatRequest(
      chatRequest(TURN, {
        url: `https://firebasestorage.googleapis.com/v0/b/PROJECT/o/${encodeURIComponent(
          "storedFiles/chat-attachments/other-user/scan.pdf",
        )}?alt=media`,
      }),
      "user",
    );

    expect(response.status).toBe(404);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("refuses a traversal that starts with the caller's uid", async () => {
    mocks.docs.set(TURN, pendingTurn());

    const response = await handleChatRequest(
      chatRequest(TURN, {
        url: `https://firebasestorage.googleapis.com/v0/b/PROJECT/o/${encodeURIComponent(
          "storedFiles/chat-attachments/user/../other-user/scan.pdf",
        )}?alt=media`,
      }),
      "user",
    );

    expect(response.status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe("completing a turn", () => {
  it("writes the answer and counts one new document", async () => {
    mocks.docs.set(TURN, { exists: true, data: { ...pendingTurn().data, claimId: "owner", claimExpiresAt: Date.now() + 120000 } });

    const result = await completeChatTurn(SESSION_ID, "user", {
      turnId: TURN,
      claimId: "owner",
      answer: "An answer.",
      answerTokens: 5,
      userTokens: 2,
    });

    expect(result).toEqual({ success: true, text: "An answer." });
    expect(mocks.set).toHaveBeenCalledWith(
      `${TURN}-a`,
      expect.objectContaining({ role: "assistant", text: "An answer." }),
    );
    expect(messageCountIncrement()).toBe(1);
  });

  it("returns the stored answer when the answer was already committed", async () => {
    mocks.docs.set(TURN, { exists: true, data: { ...pendingTurn().data, claimId: "owner", claimExpiresAt: Date.now() + 120000 } });
    mocks.docs.set(`${TURN}-a`, storedAnswer("Stored answer."));

    const result = await completeChatTurn(SESSION_ID, "user", {
      turnId: TURN,
      claimId: "owner",
      answer: "A second answer.",
      answerTokens: 5,
      userTokens: 2,
    });

    expect(result).toEqual({ success: true, text: "Stored answer." });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("does nothing when the question was discarded mid-stream", async () => {
    const result = await completeChatTurn(SESSION_ID, "user", {
      turnId: TURN,
      claimId: "owner",
      answer: "An answer.",
      answerTokens: 5,
      userTokens: 2,
    });

    expect(result).toEqual({ success: false, reason: "cancelled" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe("cancelling a turn", () => {
  it("deletes the pending question and decrements the count", async () => {
    mocks.docs.set(TURN, pendingTurn());

    const result = await cancelChatTurn(SESSION_ID, "user", TURN);

    expect(result).toEqual({ success: true, cancelled: true });
    expect(mocks.delete).toHaveBeenCalledWith(TURN);
    expect(messageCountIncrement()).toBe(-1);
  });

  it("never deletes a turn that already has an answer", async () => {
    mocks.docs.set(TURN, pendingTurn());
    mocks.docs.set(`${TURN}-a`, storedAnswer("The answer."));

    const result = await cancelChatTurn(SESSION_ID, "user", TURN);

    expect(result).toEqual({ success: true, cancelled: false });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/chat", () => {
  const request = () =>
    new Request("http://localhost/api/v1/chat", { method: "POST" });

  it("marks an App Check refusal with x-error-code", async () => {
    mocks.appCheck.mockResolvedValue({ valid: false, error: "expired" });

    const response = await chatPost(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("x-error-code")).toBe("APP_CHECK_FAILED");
  });

  it("marks an authentication refusal with x-error-code", async () => {
    mocks.authUser.mockResolvedValue(null);

    const response = await chatPost(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("x-error-code")).toBe("UNAUTHENTICATED");
  });
});

describe("DELETE /chats/:id/turns/:turnId", () => {
  it("cancels the pending turn", async () => {
    mocks.docs.set(TURN, pendingTurn());

    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: SESSION_ID, turnId: TURN }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith(TURN);
  });

  it("rejects a non-UUID turn id without reading the session", async () => {
    const response = await DELETE(
      new Request("http://localhost", { method: "DELETE" }),
      { params: Promise.resolve({ id: SESSION_ID, turnId: "legacy-id" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

 describe("generation ownership", () => {
  const message = { turnId: TURN, text: "Hello", tokenCount: 0, isFirstMessage: false };
  it("blocks a second claim and conflicting content", async () => {
    expect((await beginChatTurn(SESSION_ID, "user", message, { createIfMissing: true })).status).toBe("started");
    expect((await beginChatTurn(SESSION_ID, "user", message)).status).toBe("busy");
    expect((await beginChatTurn(SESSION_ID, "user", { ...message, text: "different" })).status).toBe("conflict");
  });
  it("allows expiry recovery but fences the old owner", async () => {
    mocks.docs.set(TURN, { exists: true, data: { ...pendingTurn().data, claimId: "old", claimExpiresAt: 1 } });
    const claim = await beginChatTurn(SESSION_ID, "user", message);
    expect(claim.status).toBe("started");
    expect(await completeChatTurn(SESSION_ID, "user", { turnId: TURN, claimId: "old", answer: "stale", answerTokens: 1, userTokens: 1 })).toMatchObject({ success: false, reason: "claim-lost" });
  });
  it("never recreates a cancelled follow-up, including cancel-before-create", async () => {
    await cancelChatTurn(SESSION_ID, "user", TURN);
    expect((await beginChatTurn(SESSION_ID, "user", message, { createIfMissing: true })).status).toBe("cancelled");
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("rejects supplied invalid headers before generation or billing", async () => {
    const req = chatRequest();
    req.headers.set("x-turn-id", "");
    expect((await handleChatRequest(req, "user")).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.usage).not.toHaveBeenCalled();
  });
  it("distinguishes database errors from discard", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await completeChatTurn(SESSION_ID, "user", { turnId: TURN, claimId: "owner", answer: "retained", answerTokens: 1, userTokens: 1 })).toMatchObject({ success: false, reason: "persistence" });
  });
 });

it("persists an attachment-only initial turn", async () => {
  const response = await createPost(new Request("http://localhost/api/v1/chats", {
    method: "POST", body: JSON.stringify({ title: "Attachment", turnId: TURN, text: "", attachment: {
      name: "scan.pdf", contentType: "application/pdf", url: "https://firebasestorage.googleapis.com/v0/b/PROJECT/o/storedFiles%2Fchat-attachments%2Fuser%2Fscan.pdf"
    } })
  }));
  expect(response.status).toBe(200);
  expect(mocks.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ role: "user", text: "", attachment: expect.objectContaining({ name: "scan.pdf" }) }));
});

describe("stream persistence", () => {
  async function finishCallback() {
    mocks.docs.set(TURN, pendingTurn());
    await handleChatRequest(chatRequest(TURN), "user");
    const execute = vi.mocked(createUIMessageStream).mock.calls[0][0].execute;
    await execute({ writer: { merge: vi.fn(), write: vi.fn(), onError: undefined } } as Parameters<typeof execute>[0]);
    const finish = vi.mocked(toUIMessageStream).mock.calls[0][0].onFinish!;
    return () => finish({ responseMessage: { parts: [{ type: "text", text: "Generated answer" }] }, isAborted: false } as Parameters<typeof finish>[0]);
  }
  it("retries storage using the generated answer without another model call", async () => {
    const finish = await finishCallback();
    mocks.transaction.mockRejectedValueOnce(new Error("temporary database outage"));
    await finish();
    expect(mocks.docs.get(`${TURN}-a`)?.data.text).toBe("Generated answer");
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(mocks.usage).toHaveBeenCalledTimes(1);
  });
  it("surfaces exhausted persistence retries and does not bill", async () => {
    const finish = await finishCallback();
    mocks.transaction.mockRejectedValue(new Error("database outage"));
    await expect(finish()).rejects.toThrow("Unable to save");
    expect(mocks.usage).not.toHaveBeenCalled();
  });
  it("silently discards cancelled answers without billing", async () => {
    const finish = await finishCallback();
    await cancelChatTurn(SESSION_ID, "user", TURN);
    await finish();
    expect(mocks.docs.has(`${TURN}-a`)).toBe(false);
    expect(mocks.usage).not.toHaveBeenCalled();
  });
});
