// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Callback Webhook Verifier
//
// If you enable "Signed Callbacks" in the pawaPay Dashboard, each inbound
// webhook includes RFC-9421 HTTP Message Signatures. This module provides
// helpers for verifying those signatures and parsing typed callback payloads.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DepositCallback,
  PayoutCallback,
  RefundCallback,
} from "../types";
import { PawaPayError } from "../errors";

// ── Typed callback parsers ────────────────────────────────────────────────────

/**
 * Parse and validate the shape of an inbound deposit callback body.
 * Throws if required fields are missing.
 */
export function parseDepositCallback(body: unknown): DepositCallback {
  assertCallbackShape(body, "depositId");
  return body as DepositCallback;
}

/**
 * Parse and validate the shape of an inbound payout callback body.
 */
export function parsePayoutCallback(body: unknown): PayoutCallback {
  assertCallbackShape(body, "payoutId");
  return body as PayoutCallback;
}

/**
 * Parse and validate the shape of an inbound refund callback body.
 */
export function parseRefundCallback(body: unknown): RefundCallback {
  assertCallbackShape(body, "refundId");
  return body as RefundCallback;
}

// ── Content-Digest verification ───────────────────────────────────────────────

/**
 * Verifies the `Content-Digest` header of a pawaPay callback.
 *
 * The header format is: `sha-256=:<base64>=:`  or  `sha-512=:<base64>=:`
 *
 * Requires the Web Crypto API (available in Node ≥ 18, all modern browsers,
 * Bun, and Deno).
 *
 * @param rawBody   The raw request body as a string (do NOT parse JSON first)
 * @param digestHeader  The value of the `Content-Digest` header
 * @returns `true` if digest matches, `false` otherwise
 */
export async function verifyContentDigest(
  rawBody: string,
  digestHeader: string
): Promise<boolean> {
  if (!digestHeader) return false;

  // Parse header: sha-256=:<base64>:  or  sha-512=:<base64>:
  // RFC-9421 format: sha-256=:<base64>:  – base64 may contain +, /, = anywhere
  const match = digestHeader.match(/^(sha-256|sha-512)=:([A-Za-z0-9+\/]+=*):$/);
  if (!match) return false;

  const [, algorithm, encodedDigest] = match;
  if (!algorithm || !encodedDigest) return false;
  const algoName = algorithm === "sha-256" ? "SHA-256" : "SHA-512";

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawBody);
    const hashBuffer = await crypto.subtle.digest(algoName, data);
    const hashBase64 = btoa(
      String.fromCharCode(...new Uint8Array(hashBuffer))
    );
    return timingSafeEqual(hashBase64, encodedDigest);
  } catch {
    return false;
  }
}

// ── Signature presence check ──────────────────────────────────────────────────

/**
 * Light-weight check that the required RFC-9421 signature headers are present
 * on an inbound request. Full cryptographic verification requires the pawaPay
 * public keys (fetch via `toolkit.getPublicKeys()`).
 *
 * @param headers A plain object or Headers instance from your web framework
 */
export function hasSignatureHeaders(
  headers: Record<string, string | string[] | undefined> | Headers
): boolean {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const val = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };
  return !!(get("signature") && get("signature-input"));
}

/**
 * Extract structured metadata from the `signature-input` header.
 *
 * From the real pawaPay callback:
 *   sig-pp=("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");
 *          alg="ecdsa-p256-sha256";keyid="HTTP_EC_P256_KEY:1";created=...;expires=...
 *
 * Returns `null` if the header is absent or malformed.
 */
export function parseSignatureInput(signatureInput: string): {
  label: string;
  coveredComponents: string[];
  alg: string;
  keyid: string;
  created?: number;
  expires?: number;
} | null {
  if (!signatureInput) return null;
  try {
    const labelMatch = signatureInput.match(/^([^=]+)=/);
    if (!labelMatch?.[1]) return null;
    const label = labelMatch[1];

    const componentsMatch = signatureInput.match(/\(([^)]+)\)/);
    const coveredComponents = componentsMatch?.[1]
      ?.split(" ")
      .map((c) => c.replace(/"/g, ""))
      ?? [];

    const alg = signatureInput.match(/alg="([^"]+)"/)?.[1] ?? "";
    const keyid = signatureInput.match(/keyid="([^"]+)"/)?.[1] ?? "";
    const created = signatureInput.match(/created=(\d+)/)?.[1];
    const expires = signatureInput.match(/expires=(\d+)/)?.[1];

    return {
      label,
      coveredComponents,
      alg,
      keyid,
      created: created ? Number(created) : undefined,
      expires: expires ? Number(expires) : undefined,
    };
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertCallbackShape(body: unknown, idField: string): void {
  if (
    typeof body !== "object" ||
    body === null ||
    !(idField in body) ||
    !("status" in body)
  ) {
    throw new PawaPayError(
      `Invalid callback payload: missing required fields "${idField}" and/or "status".`
    );
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Only safe for same-length strings of ASCII characters.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
