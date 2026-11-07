import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleTranscribeRequest,
  transcribePostSchema,
} from "@/lib/api/handlers/transcribe";
import * as transcribeService from "@/services/transcribe";

vi.mock("@/services/transcribe", () => ({
  transcribeDocument: vi.fn(),
}));

describe("transcribePostSchema", () => {
  it("validates storagePath input (preferred method)", () => {
    const input = {
      storagePath: "temp/transcriptions/user-123/1730000_doc.pdf",
      mimeType: "application/pdf",
      formatMode: "professional",
      fileName: "doc.pdf",
    };
    const result = transcribePostSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.storagePath).toBe(
        "temp/transcriptions/user-123/1730000_doc.pdf",
      );
      expect(result.data.mimeType).toBe("application/pdf");
    }
  });

  it("normalizes mimeType image/jpg to image/jpeg", () => {
    const input = {
      storagePath: "temp/transcriptions/user-123/photo.jpg",
      mimeType: "image/jpg",
      formatMode: "professional",
      fileName: "photo.jpg",
    };
    const result = transcribePostSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mimeType).toBe("image/jpeg");
      expect(result.data.formatMode).toBe("professional");
    }
  });

  it("rejects when storagePath is missing", () => {
    const input = {
      mimeType: "application/pdf",
      formatMode: "professional",
      fileName: "doc.pdf",
    };
    const result = transcribePostSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects unsupported MIME types", () => {
    const input = {
      storagePath: "temp/transcriptions/user-123/doc.zip",
      mimeType: "application/zip",
      formatMode: "original",
      fileName: "archive.zip",
    };
    const result = transcribePostSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid formatMode", () => {
    const input = {
      storagePath: "temp/transcriptions/user-123/doc.pdf",
      mimeType: "application/pdf",
      formatMode: "custom-mode",
      fileName: "doc.pdf",
    };
    const result = transcribePostSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("handleTranscribeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 413 if content-length exceeds 32 KB", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: {
        "content-length": "40000",
      },
      body: JSON.stringify({}),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toContain("Payload too large");
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json",
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body.");
  });

  it("returns 400 when required fields are missing", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: "test.pdf" }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects storagePath with directory traversal attempts (400)", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/../../etc/secrets.json",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "secrets.json",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid storage path");
  });

  it("rejects storagePath outside temp transcriptions folder (400)", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "storedFiles/private/secret.pdf",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "secret.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid storage path");
  });

  it("rejects storagePath belonging to another user (IDOR prevention 400)", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/other-user-999/notes.pdf",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "notes.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid storage path");
  });

  it("rejects storagePath pointing to a directory instead of a file (400)", async () => {
    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/user-123/",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "notes.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid storage path");
  });

  it("returns 402 when user has insufficient credits", async () => {
    vi.mocked(transcribeService.transcribeDocument).mockResolvedValueOnce({
      success: false,
      error: "Insufficient tokens.",
      errorType: "INSUFFICIENT_CREDITS",
    });

    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/user-123/notes.pdf",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "notes.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe("Insufficient tokens.");
  });

  it("returns 422 when the document is corrupt or undecodable", async () => {
    vi.mocked(transcribeService.transcribeDocument).mockResolvedValueOnce({
      success: false,
      error:
        "The uploaded file could not be decoded by the AI engine. Please ensure it is a valid, uncorrupted image (PNG, JPEG, WebP) or PDF.",
      errorType: "CORRUPT_FILE",
    });

    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/user-123/corrupt.jpg",
        mimeType: "image/jpeg",
        formatMode: "professional",
        fileName: "corrupt.jpg",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toContain("could not be decoded");
  });

  it("returns 500 when transcription fails with an unexpected internal error", async () => {
    vi.mocked(transcribeService.transcribeDocument).mockResolvedValueOnce({
      success: false,
      error: "Unexpected database failure.",
      errorType: "GENERAL",
    });

    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/user-123/doc.pdf",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "doc.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Unexpected database failure.");
  });

  it("returns 200 on successful transcription via storagePath", async () => {
    vi.mocked(transcribeService.transcribeDocument).mockResolvedValueOnce({
      success: true,
      text: "# Transcribed Content\nDirect-from-storage transcription.",
      totalTokens: 120,
    });

    const req = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storagePath: "temp/transcriptions/user-123/doc.pdf",
        mimeType: "application/pdf",
        formatMode: "professional",
        fileName: "doc.pdf",
      }),
    });

    const res = await handleTranscribeRequest(req, "user-123");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.text).toContain("Direct-from-storage transcription");
    expect(data.totalTokens).toBe(120);
  });
});
