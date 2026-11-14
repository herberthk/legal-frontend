/**
 * Validation for attachment URLs handed to the model provider.
 *
 * The provider fetches these URLs itself, so an unvalidated value turns the
 * server into a request proxy: an internal host, another user's object, or a
 * path outside the chat prefix would all be fetched with the server's network
 * position. The same check runs before a pending turn is persisted and again
 * before generation, so a stored row can never carry a URL the handler has not
 * approved.
 */

export const ALLOWED_FILE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

/** Only the app's own chat-attachment prefix may be read as model input. */
export const ALLOWED_ATTACHMENT_PREFIX = "storedFiles/chat-attachments/";

export type AttachmentUrlCheck =
  | { ok: true; url: URL }
  | { ok: false; status: 400 | 404; message: string };

const NOT_ALLOWED: AttachmentUrlCheck = {
  ok: false,
  status: 400,
  message: "Attachment URL is not allowed.",
};

const NOT_FOUND: AttachmentUrlCheck = {
  ok: false,
  status: 404,
  message: "Attachment not found.",
};

export function isAllowedFileUrl(url: URL): boolean {
  return url.protocol === "https:" && ALLOWED_FILE_HOSTS.has(url.hostname);
}

/**
 * The Storage object path encoded after `/o/` in a download URL.
 *
 * Both Firebase Storage hosts encode the whole path as one segment, so it has to
 * be decoded before it can be inspected as a path again. Returns `null` for a
 * URL that carries no object segment or whose encoding is malformed.
 */
export function decodeAttachmentPath(url: URL): string | null {
  const marker = "/o/";
  const at = url.pathname.indexOf(marker);
  if (at < 0) return null;
  const segment = url.pathname.slice(at + marker.length).split("/")[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function checkAttachmentUrl(
  rawUrl: string,
  userId: string,
): AttachmentUrlCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NOT_ALLOWED;
  }

  if (!isAllowedFileUrl(url)) return NOT_ALLOWED;

  const path = decodeAttachmentPath(url);
  if (!path || !path.startsWith(ALLOWED_ATTACHMENT_PREFIX)) {
    return NOT_ALLOWED;
  }

  const rest = path.slice(ALLOWED_ATTACHMENT_PREFIX.length);
  const segments = rest.split("/");

  // An empty segment is either a trailing slash or a doubled separator; neither
  // names a real object and both are a way to make the owner check read one
  // value while Storage reads another.
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    return NOT_ALLOWED;
  }

  // `.` and `..` would let a path start with the caller's uid and still resolve
  // into another user's subtree once a consumer normalises it.
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return NOT_ALLOWED;
  }

  // New uploads are `<uid>/<uuid>-<name>`; legacy uploads are one segment.
  // Anything deeper is not a shape this app writes.
  if (segments.length > 2) return NOT_ALLOWED;

  if (segments.length === 2 && segments[0] !== userId) {
    // Someone else's object: report it as missing rather than confirming it.
    return NOT_FOUND;
  }

  return { ok: true, url };
}
