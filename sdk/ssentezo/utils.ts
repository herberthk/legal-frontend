// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Utilities
// ─────────────────────────────────────────────

/**
 * Encode a string to base64.
 * Uses Node.js Buffer when available (Next.js server / Edge Runtime + Node.js),
 * falls back to the Web Crypto-based `btoa` for pure Edge environments.
 */
export function base64Encode(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  // Pure Edge Runtime (no Buffer) — btoa is available globally
  return btoa(unescape(encodeURIComponent(value)));
}

/**
 * Pause execution for `ms` milliseconds.
 * Used internally for exponential back-off between retries.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate the delay for retry attempt `n` (1-based) using full jitter
 * exponential back-off:
 *
 *   delay = random(0, min(cap, base * 2^(n-1)))
 *
 * This avoids the "thundering herd" problem when many clients retry at once.
 *
 * @param attempt  1-based attempt number.
 * @param baseMs   Base delay in ms (default: 1000).
 * @param capMs    Maximum delay in ms (default: 16000).
 */
export function retryDelay(
  attempt: number,
  baseMs = 1_000,
  capMs = 16_000
): number {
  const ceiling = Math.min(capMs, baseMs * Math.pow(2, attempt - 1));
  return Math.floor(Math.random() * ceiling);
}

/**
 * Generate a cryptographically random UUID v4 suitable for use as an
 * `externalReference`.
 *
 * Compatible with Node.js ≥ 14.17, Edge Runtime, and modern browsers.
 *
 * @example
 * const ref = generateReference();
 * // "3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"
 */
export function generateReference(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for Node.js < 19 without global crypto
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID } = require("crypto") as { randomUUID: () => string };
  return randomUUID();
}

/**
 * Generate a prefixed reference, useful for tracing transactions back to
 * a specific order or entity in your system.
 *
 * @example
 * const ref = generatePrefixedReference("order");
 * // "order_3a8f2c1d-4b5e-4a6f-8c9d-0e1f2a3b4c5d"
 */
export function generatePrefixedReference(prefix: string): string {
  return `${prefix}_${generateReference()}`;
}

/**
 * Parse and validate an incoming Ssentezo callback payload.
 * Returns the parsed payload or `null` if the shape is invalid.
 *
 * Use this in your callback route handler to safely consume webhook data.
 *
 * @example
 * // app/api/ssentezo/callback/route.ts
 * const payload = parseCallbackPayload(await req.json());
 * if (!payload) return new Response("Bad Request", { status: 400 });
 */
export function parseCallbackPayload(
  body: unknown
): {
  transactionStatus: "SUCCEEDED" | "FAILED";
  ssentezoWalletReference: string;
  externalReference: string;
  financialTransactionId: string;
} | null {
  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>)["response"] !== "OK"
  ) {
    return null;
  }

  const data = (body as Record<string, unknown>)["data"];
  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;

  const status = d["transactionStatus"];
  if (status !== "SUCCEEDED" && status !== "FAILED") return null;

  if (
    typeof d["ssentezoWalletReference"] !== "string" ||
    typeof d["externalReference"] !== "string" ||
    typeof d["financialTransactionId"] !== "string"
  ) {
    return null;
  }

  return {
    transactionStatus: status,
    ssentezoWalletReference: d["ssentezoWalletReference"] as string,
    externalReference: d["externalReference"] as string,
    financialTransactionId: d["financialTransactionId"] as string,
  };
}
