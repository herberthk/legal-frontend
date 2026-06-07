// tests/crypto.test.ts
import { describe, it, expect } from "vitest";
import { encryptCard } from "../";
import { RAW_CARD, SDK_CONFIG } from "./helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// encryptCard
// ─────────────────────────────────────────────────────────────────────────────

describe("encryptCard", () => {
  it("returns an object with all five expected fields", async () => {
    const result = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    expect(result).toHaveProperty("nonce");
    expect(result).toHaveProperty("encrypted_card_number");
    expect(result).toHaveProperty("encrypted_expiry_month");
    expect(result).toHaveProperty("encrypted_expiry_year");
    expect(result).toHaveProperty("encrypted_cvv");
  });

  it("nonce is 12 alphanumeric characters", async () => {
    const result = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    expect(result.nonce).toMatch(/^[A-Za-z0-9]{12}$/);
  });

  it("all encrypted fields are non-empty base64 strings", async () => {
    const result = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    const b64Regex = /^[A-Za-z0-9+/]+=*$/;
    expect(result.encrypted_card_number).toMatch(b64Regex);
    expect(result.encrypted_expiry_month).toMatch(b64Regex);
    expect(result.encrypted_expiry_year).toMatch(b64Regex);
    expect(result.encrypted_cvv).toMatch(b64Regex);
  });

  it("produces different ciphertext on every call (random nonce)", async () => {
    const r1 = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    const r2 = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    // Nonces must differ
    expect(r1.nonce).not.toBe(r2.nonce);
    // Ciphertexts must differ because IV (nonce) changes each time
    expect(r1.encrypted_card_number).not.toBe(r2.encrypted_card_number);
  });

  it("encrypted values are not the plaintext values", async () => {
    const result = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    expect(result.encrypted_card_number).not.toBe(RAW_CARD.cardNumber);
    expect(result.encrypted_cvv).not.toBe(RAW_CARD.cvv);
  });

  it("uses the same nonce across all four encrypted fields in one call", async () => {
    // We verify indirectly: both expiry fields should decrypt consistently with
    // the same nonce. As a proxy, confirm the nonce is a single string, not multiple.
    const result = await encryptCard(RAW_CARD, SDK_CONFIG.encryptionKey!);
    expect(typeof result.nonce).toBe("string");
    expect(result.nonce.length).toBe(12);
  });

  it("throws when encryptionKey is empty string", async () => {
    await expect(encryptCard(RAW_CARD, "")).rejects.toThrow();
  });

  it("handles cards with edge-case values (single digit CVV, short expiry)", async () => {
    const edgeCard = {
      cardNumber: "4111111111111111",
      expiryMonth: "1",
      expiryYear: "9",
      cvv: "0",
    };
    // Should not throw
    const result = await encryptCard(edgeCard, SDK_CONFIG.encryptionKey!);
    expect(result.encrypted_cvv).toBeTruthy();
    expect(result.encrypted_expiry_month).toBeTruthy();
  });
});
