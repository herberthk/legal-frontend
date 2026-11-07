import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveTranscriptionRecord, transcribeDocument } from "@/services/transcribe";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), set: vi.fn(),
  exists: vi.fn(), download: vi.fn(), move: vi.fn(), restore: vi.fn(),
  metadata: vi.fn(), generate: vi.fn(), credits: vi.fn(), bucket: vi.fn(),
}));
vi.mock("@/firebase/admin", () => ({
  db: { collection: () => ({ doc: () => ({ id: "record", get: mocks.get, update: mocks.update, set: mocks.set }) }) },
  storageAdmin: { bucket: mocks.bucket },
}));
vi.mock("@/lib/actions/usage", () => ({ checkUserCanSend: mocks.credits, recordUsageAndDeduct: vi.fn() }));
vi.mock("ai", () => ({ generateText: mocks.generate }));
vi.mock("@/lib/actions/vertex", () => ({ vertex: vi.fn() }));
vi.mock("@/lib/document-extractor", () => ({ extractDocumentText: vi.fn() }));

const tempStoragePath = "temp/transcriptions/user/document.png";
const data = { fileName: "document.png", tempStoragePath } as Parameters<typeof saveTranscriptionRecord>[0];
const params = { storagePath: tempStoragePath, fileName: "document.png", mimeType: "image/png", formatMode: "original" as const };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.get.mockResolvedValue({ exists: true, data: () => ({ userId: "user" }) });
  mocks.exists.mockResolvedValue([true]);
  mocks.download.mockResolvedValue([Buffer.from("image")]);
  mocks.metadata.mockResolvedValue([{ metadata: { firebaseStorageDownloadTokens: "token" } }]);
  mocks.bucket.mockReturnValue({ name: "bucket", file: (path: string) => path === tempStoragePath
    ? { exists: mocks.exists, download: mocks.download, move: mocks.move }
    : { getMetadata: mocks.metadata, move: mocks.restore } });
  mocks.credits.mockResolvedValue({ canSend: true, user: { freeTextTokens: 100000 } });
});

describe("transcription error messages", () => {
  it("sanitizes unexpected provider failures while logging the original error", async () => {
    const error = new Error("private provider endpoint and credentials");
    mocks.generate.mockRejectedValue(error);
    expect(await transcribeDocument(params, "user")).toMatchObject({ success: false, errorType: "GENERAL", error: "An unexpected error occurred during transcription." });
    expect(console.error).toHaveBeenCalledWith("--- Server Transcribe Error ---", error);
  });
  it("preserves corrupt file classification", async () => {
    mocks.generate.mockRejectedValue(new Error("INVALID_ARGUMENT private detail"));
    expect(await transcribeDocument(params, "user")).toMatchObject({ success: false, errorType: "CORRUPT_FILE", error: expect.stringContaining("could not be decoded") });
  });
  it("preserves intentional user-facing errors", async () => {
    expect(await transcribeDocument(params, "")).toMatchObject({ error: "Unauthorized: Please sign in to transcribe documents." });
  });
});

describe("transcription file promotion", () => {
  it.each([false, true])("rejects missing or foreign records before touching storage (exists=%s)", async (exists) => {
    mocks.get.mockResolvedValue({ exists, data: () => ({ userId: "other" }) });
    expect(await saveTranscriptionRecord({ ...data, id: "foreign" }, "user")).toMatchObject({ success: false, notFound: true });
    expect(mocks.bucket).not.toHaveBeenCalled();
  });
  it.each([undefined, "existing"])("restores the temp file after a failed write (id=%s), allowing retry", async (id) => {
    const write = id ? mocks.update : mocks.set;
    write.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await saveTranscriptionRecord({ ...data, id }, "user")).toMatchObject({ success: false });
    expect(mocks.restore).toHaveBeenCalledWith(tempStoragePath);
    expect(await saveTranscriptionRecord({ ...data, id }, "user")).toMatchObject({ success: true, filePromoted: true });
  });
  it("keeps a successfully saved file in permanent storage", async () => {
    expect(await saveTranscriptionRecord(data, "user")).toMatchObject({ success: true, filePromoted: true });
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("restores the temp file if metadata retrieval fails after moving", async () => {
    mocks.metadata.mockRejectedValue(new Error("metadata unavailable"));
    expect(await saveTranscriptionRecord(data, "user")).toMatchObject({ success: true, filePromoted: false });
    expect(mocks.restore).toHaveBeenCalledWith(tempStoragePath);
  });
});
