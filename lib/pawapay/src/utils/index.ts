// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { PawaPayValidationError } from "../errors";

// ── UUID helpers ──────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns true if value is a valid UUIDv4 string */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Generates a UUIDv4 using the Web Crypto API (available in Node ≥ 19,
 * browsers, and Deno/Bun out of the box).
 */
export function generateUUID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Polyfill for older Node.js without globalThis.crypto
  // Uses Math.random as fallback — sufficient for non-security-critical IDs
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Amount validation ─────────────────────────────────────────────────────────

/** pawaPay amount pattern: no leading zeros, optional decimals (up to 4 dp) */
const AMOUNT_REGEX = /^([0]|([1-9][0-9]{0,17}))([.][0-9]{0,3}[1-9])?$/;

export function validateAmount(amount: string, field = "amount"): void {
  if (!amount || !AMOUNT_REGEX.test(amount)) {
    throw new PawaPayValidationError(
      `Invalid amount "${amount}". Must be a positive number without leading zeros (e.g. "150" or "9.50").`,
      field
    );
  }
}

/** Formats a JS number to a valid pawaPay amount string */
export function formatAmount(value: number, decimals = 2): string {
  if (value <= 0) {
    throw new PawaPayValidationError("Amount must be greater than 0.", "amount");
  }
  if (decimals === 0) return String(Math.round(value));
  const str = value.toFixed(decimals);
  // Trim trailing zeros after decimal, but always keep at least one dp if decimal
  return str.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

// ── Phone number sanitisation ─────────────────────────────────────────────────

/**
 * Strips leading '+', spaces, dashes and non-numeric chars.
 * Returns digits-only MSISDN suitable for pawaPay.
 */
export function sanitisePhoneNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** Basic check: digits only, no leading zero, 7–15 chars */
export function validatePhoneNumber(phone: string, field = "phoneNumber"): void {
  if (!/^[1-9][0-9]{6,14}$/.test(phone)) {
    throw new PawaPayValidationError(
      `Invalid phone number "${phone}". Must be digits only, no leading zero, with country code (e.g. "256700123456").`,
      field
    );
  }
}

// ── UUID validation ───────────────────────────────────────────────────────────

export function validatePaymentId(id: string, field: string): void {
  if (!isValidUUID(id)) {
    throw new PawaPayValidationError(
      `"${field}" must be a valid UUIDv4 (got "${id}").`,
      field
    );
  }
}

// ── Customer message validation ───────────────────────────────────────────────

const CUSTOMER_MSG_REGEX = /^[a-zA-Z0-9 ]{4,22}$/;

export function validateCustomerMessage(msg: string): void {
  if (!CUSTOMER_MSG_REGEX.test(msg)) {
    throw new PawaPayValidationError(
      `customerMessage must be 4–22 alphanumeric characters (got "${msg}").`,
      "customerMessage"
    );
  }
}

// ── Metadata validation ───────────────────────────────────────────────────────

export function validateMetadata(
  metadata: Array<Record<string, unknown>>
): void {
  if (metadata.length > 10) {
    throw new PawaPayValidationError(
      "A maximum of 10 metadata fields are allowed per transaction.",
      "metadata"
    );
  }
  const keys = metadata.flatMap((item) =>
    Object.keys(item).filter((k) => k !== "isPII")
  );
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size !== keys.length) {
    throw new PawaPayValidationError(
      "Duplicate metadata field keys are not allowed.",
      "metadata"
    );
  }
}

// ── Retry with exponential backoff ────────────────────────────────────────────

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/** Default retry predicate: retry on network errors and 5xx responses */
export function defaultShouldRetry(error: unknown, _attempt: number): boolean {
  if (error instanceof TypeError) return true; // network failure
  if (
    typeof error === "object" &&
    error !== null &&
    "httpStatus" in error &&
    typeof (error as Record<string, unknown>).httpStatus === "number"
  ) {
    return (error as Record<string, unknown>).httpStatus as number >= 500;
  }
  return false;
}

/**
 * Executes `fn`, retrying up to `maxRetries` times on failure.
 * Uses full-jitter exponential backoff to spread load.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelay, shouldRetry = defaultShouldRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxRetries;
      if (isLast || !shouldRetry(err, attempt)) throw err;

      // Full-jitter exponential backoff
      const cap = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * cap;
      await sleep(jitter);
    }
  }

  // Never reached, but keeps TS happy
  throw lastError;
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── AbortSignal timeout (polyfill for Node < 17.3) ───────────────────────────

export function createTimeoutSignal(ms: number): AbortSignal {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof (AbortSignal as unknown as Record<string, unknown>).timeout ===
      "function"
  ) {
    return (
      AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }
    ).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// ── Env URL resolver ─────────────────────────────────────────────────────────

export const BASE_URLS = {
  sandbox: "https://api.sandbox.pawapay.io",
  production: "https://api.pawapay.io",
} as const;
