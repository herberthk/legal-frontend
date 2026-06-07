// ─────────────────────────────────────────────────────────────────────────────
// crypto.ts — AES-256-GCM encryption for card fields (isomorphic)
//
// Uses the Web Crypto API (available in Node 18+, all modern browsers, Bun).
// Follows Flutterwave v4 encryption spec exactly.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawCardDetails, EncryptedCardDetails } from "./";

const NONCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a cryptographically random 12-char alphanumeric nonce. */
function generateNonce(): string {
  const arr = new Uint8Array(12);
  getCrypto().getRandomValues(arr);
  return Array.from(arr)
    .map((b) => NONCE_CHARS[b % NONCE_CHARS.length])
    .join("");
}

/** Resolve the Crypto object in both Node and browser environments. */
function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    return globalThis.crypto;
  }
  // Node < 19 fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require("crypto");
  return webcrypto as Crypto;
}

/**
 * Encrypt a single plaintext string using AES-256-GCM.
 *
 * @param plaintext  - Value to encrypt (card number, CVV, etc.)
 * @param b64Key     - Base64-encoded AES-256 key from Flutterwave dashboard
 * @param nonce      - 12-char alphanumeric nonce (shared across one card object)
 */
async function encryptField(
  plaintext: string,
  b64Key: string,
  nonce: string
): Promise<string> {
  const crypto = getCrypto();

  const keyBytes = Uint8Array.from(atob(b64Key), (c) => c.charCodeAt(0));
  const iv = new TextEncoder().encode(nonce); // 12 bytes UTF-8

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  return btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
}

/**
 * Encrypt all sensitive card fields in parallel using a single shared nonce.
 * Returns the encrypted object ready to drop straight into the orchestrator payload.
 *
 * @throws {Error} if the encryption key is missing or malformed.
 */
export async function encryptCard(
  card: RawCardDetails,
  encryptionKey: string
): Promise<EncryptedCardDetails> {
  if (!encryptionKey) {
    throw new Error(
      "encryptionKey is required in FlwUgSdkConfig to process card payments."
    );
  }

  const nonce = generateNonce();

  const [
    encrypted_card_number,
    encrypted_expiry_month,
    encrypted_expiry_year,
    encrypted_cvv,
  ] = await Promise.all([
    encryptField(card.cardNumber, encryptionKey, nonce),
    encryptField(card.expiryMonth, encryptionKey, nonce),
    encryptField(card.expiryYear, encryptionKey, nonce),
    encryptField(card.cvv, encryptionKey, nonce),
  ]);

  return {
    nonce,
    encrypted_card_number,
    encrypted_expiry_month,
    encrypted_expiry_year,
    encrypted_cvv,
  };
}
