import { createHash } from "crypto";

/**
 * Derives a deterministic, Firestore-safe document ID from a raw FCM token.
 * Raw tokens can exceed 4,000 characters and contain characters unsafe for Firestore keys.
 * A SHA-256 hash gives a fixed 64-character hex string that is safe for document keys.
 */
export function getFCMTokenDocId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
