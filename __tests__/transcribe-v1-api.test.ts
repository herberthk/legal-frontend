import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTranscriptions,
  renameTranscriptionRecord,
} from "@/services/transcribe";
import { PATCH } from "@/app/api/v1/transcriptions/[id]/route";
import { POST } from "@/app/api/v1/transcriptions/route";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  queryGet: vi.fn(),
  requireMobileAuth: vi.fn(),
  transcribeDocument: vi.fn(),
}));

vi.mock("@/firebase/admin", () => {
  const buildQuery = () => ({
    where: () => buildQuery(),
    orderBy: () => buildQuery(),
    startAfter: () => buildQuery(),
    limit: () => ({ get: mocks.queryGet }),
  });

  return {
    db: {
      collection: () => ({
        doc: () => ({
          id: "rec-1",
          get: mocks.get,
          update: mocks.update,
        }),
        where: () => buildQuery(),
      }),
    },
    storageAdmin: { bucket: vi.fn() },
  };
});

vi.mock("@/lib/api/v1/guard", () => ({
  requireMobileAuth: mocks.requireMobileAuth,
}));

vi.mock("@/lib/actions/usage", () => ({
  checkUserCanSend: vi.fn(),
  recordUsageAndDeduct: vi.fn(),
}));

vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/actions/vertex", () => ({ vertex: vi.fn() }));
vi.mock("@/lib/document-extractor", () => ({ extractDocumentText: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireMobileAuth.mockResolvedValue({ userId: "user-1" });
});

describe("renameTranscriptionRecord", () => {
  it("returns notFound when record does not exist or belongs to another user", async () => {
    mocks.get.mockResolvedValueOnce({ exists: false });
    expect(
      await renameTranscriptionRecord("rec-1", "New Title", "user-1"),
    ).toMatchObject({ success: false, notFound: true });

    mocks.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userId: "other-user" }),
    });
    expect(
      await renameTranscriptionRecord("rec-1", "New Title", "user-1"),
    ).toMatchObject({ success: false, notFound: true });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates title and updatedAt for the owner", async () => {
    mocks.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userId: "user-1" }),
    });
    mocks.update.mockResolvedValueOnce(undefined);

    const res = await renameTranscriptionRecord("rec-1", "Lease Agreement", "user-1");
    expect(res).toEqual({
      success: true,
      id: "rec-1",
      title: "Lease Agreement",
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Lease Agreement" }),
    );
  });
});

describe("PATCH /api/v1/transcriptions/:id", () => {
  it("rejects empty title with 400", async () => {
    const req = new Request("http://localhost/api/v1/transcriptions/rec-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when record is not found", async () => {
    mocks.get.mockResolvedValueOnce({ exists: false });
    const req = new Request("http://localhost/api/v1/transcriptions/rec-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Valid Title" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 and updated title on success", async () => {
    mocks.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ userId: "user-1" }),
    });
    mocks.update.mockResolvedValueOnce(undefined);

    const req = new Request("http://localhost/api/v1/transcriptions/rec-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Renamed Exhibit" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      success: true,
      id: "rec-1",
      title: "Renamed Exhibit",
    });
  });
});

describe("POST /api/v1/transcriptions", () => {
  it("rejects payloads over 32 KB", async () => {
    const req = new Request("http://localhost/api/v1/transcriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "40000",
      },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("getTranscriptions case-insensitive search", () => {
  it("matches title, fileName, and body case-insensitively", async () => {
    const makeDoc = (
      id: string,
      title: string,
      fileName: string,
      transcribedText: string,
    ) => ({
      id,
      data: () => ({
        userId: "user-1",
        title,
        fileName,
        transcribedText,
        formatMode: "professional",
        createdAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
      }),
    });

    mocks.queryGet.mockResolvedValueOnce({
      docs: [
        makeDoc("1", "Kampala Tenancy", "lease.pdf", "<p>Monthly rent agreement</p>"),
        makeDoc("2", "Affidavit", "scan-02.jpg", "<p>Sworn in High Court</p>"),
        makeDoc("3", "Receipt", "receipt_kampala.png", "<p>Paid in full</p>"),
      ],
    });

    const res = await getTranscriptions(10, undefined, "KAMPALA", "30d", "user-1");
    expect(res.success).toBe(true);
    expect(res.transcriptions.map((r) => r.id)).toEqual(["1", "3"]);
    expect(res.hasMore).toBe(false);
  });

  it("decodes HTML entities in body text so apostrophes and ampersands match", async () => {
    const doc = {
      id: "4",
      data: () => ({
        userId: "user-1",
        title: "Agreement",
        fileName: "doc.pdf",
        transcribedText: "<p>O&#39;Connor &amp; Associates LLP</p>",
        formatMode: "professional",
        createdAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
      }),
    };
    mocks.queryGet.mockResolvedValueOnce({ docs: [doc] });

    const res = await getTranscriptions(10, undefined, "O'Connor & Associates", "all", "user-1");
    expect(res.success).toBe(true);
    expect(res.transcriptions.map((r) => r.id)).toEqual(["4"]);
  });

  it("ignores out-of-range numeric HTML entities without throwing", async () => {
    const doc = {
      id: "5",
      data: () => ({
        userId: "user-1",
        title: "Malformed Entity",
        fileName: "doc.pdf",
        transcribedText: "<p>Valid &#9999999; &#x110000; contract</p>",
        formatMode: "professional",
        createdAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
      }),
    };
    mocks.queryGet.mockResolvedValueOnce({ docs: [doc] });

    const res = await getTranscriptions(10, undefined, "contract", "all", "user-1");
    expect(res.success).toBe(true);
    expect(res.transcriptions.map((r) => r.id)).toEqual(["5"]);
  });

  it("sets nextCursorId to last returned match when batch fills early", async () => {
    const batch = Array.from({ length: 50 }, (_, i) => ({
      id: `match-${i}`,
      data: () => ({
        userId: "user-1",
        title: `Lease ${i}`,
        fileName: "lease.pdf",
        transcribedText: "<p>Lease body</p>",
        formatMode: "professional",
        createdAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
      }),
    }));
    mocks.queryGet.mockResolvedValueOnce({ docs: batch });

    const res = await getTranscriptions(2, undefined, "lease", "all", "user-1");
    expect(res.success).toBe(true);
    expect(res.transcriptions.map((r) => r.id)).toEqual(["match-0", "match-1"]);
    expect(res.hasMore).toBe(true);
    expect((res as { nextCursorId?: string }).nextCursorId).toBe("match-1");
  });

  it("returns nextCursorId when bounded scan hits MAX_SCAN with more docs remaining", async () => {
    const batch = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i}`,
      data: () => ({
        userId: "user-1",
        title: "Unrelated",
        fileName: "file.pdf",
        transcribedText: "<p>Body</p>",
        formatMode: "professional",
        createdAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
        updatedAt: { toDate: () => new Date("2026-10-01T10:00:00Z") },
      }),
    }));
    mocks.queryGet
      .mockResolvedValueOnce({ docs: batch })
      .mockResolvedValueOnce({ docs: batch })
      .mockResolvedValueOnce({ docs: batch });

    const res = await getTranscriptions(10, undefined, "needle", "all", "user-1");
    expect(res.success).toBe(true);
    expect(res.transcriptions).toEqual([]);
    expect(res.hasMore).toBe(true);
    expect((res as { nextCursorId?: string }).nextCursorId).toBe("doc-99");
  });

  it("PATCH /api/v1/transcriptions/:id rejects oversized content-length > 8 KB", async () => {
    const req = new Request("http://localhost/api/v1/transcriptions/rec-1", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "content-length": String(9 * 1024),
      },
      body: JSON.stringify({ title: "New Title" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "rec-1" }) });
    expect(res.status).toBe(400);
  });
});
