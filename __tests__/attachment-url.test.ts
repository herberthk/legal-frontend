/**
 * Attachment URL validation is a security boundary, not a formatting check: the
 * model provider fetches whatever URL survives it. These cases pin the host,
 * prefix, ownership and path-shape rules, including the traversal shape that
 * starts with the caller's own uid.
 */
import { describe, expect, it } from "vitest";

import {
  ALLOWED_ATTACHMENT_PREFIX,
  checkAttachmentUrl,
} from "@/lib/api/v1/attachment-url";

function storageUrl(objectPath: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/project/o/${encodeURIComponent(
    objectPath,
  )}?alt=media`;
}

describe("checkAttachmentUrl", () => {
  it("accepts the caller's own uid-scoped object", () => {
    const url = storageUrl(`${ALLOWED_ATTACHMENT_PREFIX}user/lease.pdf`);
    expect(checkAttachmentUrl(url, "user")).toMatchObject({ ok: true });
  });

  it("rejects a legacy upload whose owner cannot be verified", () => {
    const url = storageUrl(`${ALLOWED_ATTACHMENT_PREFIX}1700000000000-lease.pdf`);
    expect(checkAttachmentUrl(url, "user")).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects another user's object as not found", () => {
    const url = storageUrl(`${ALLOWED_ATTACHMENT_PREFIX}other-user/lease.pdf`);
    expect(checkAttachmentUrl(url, "user")).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("rejects a path outside the chat prefix", () => {
    const url = storageUrl("storedFiles/reviews/scan.pdf");
    expect(checkAttachmentUrl(url, "user")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a foreign host", () => {
    expect(
      checkAttachmentUrl("https://example.test/storedFiles/chat-attachments/user/a.pdf", "user"),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects dot segments even when the first segment is the caller", () => {
    const url = storageUrl(
      `${ALLOWED_ATTACHMENT_PREFIX}user/../other-user/lease.pdf`,
    );
    expect(checkAttachmentUrl(url, "user")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a depth this app never writes", () => {
    const url = storageUrl(`${ALLOWED_ATTACHMENT_PREFIX}user/nested/lease.pdf`);
    expect(checkAttachmentUrl(url, "user")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects an empty segment", () => {
    const url = storageUrl(`${ALLOWED_ATTACHMENT_PREFIX}user//lease.pdf`);
    expect(checkAttachmentUrl(url, "user")).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a malformed URL and a missing object segment", () => {
    expect(checkAttachmentUrl("not a url", "user")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(
      checkAttachmentUrl(
        "https://firebasestorage.googleapis.com/v0/b/project",
        "user",
      ),
    ).toMatchObject({ ok: false, status: 400 });
  });
});
