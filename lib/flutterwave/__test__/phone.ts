// ─────────────────────────────────────────────────────────────────────────────
// phone.ts — Uganda MSISDN utilities
// ─────────────────────────────────────────────────────────────────────────────

import type { UgandaNetwork, PhoneValidationResult } from "../";

/**
 * Uganda network prefix map.
 * Keys are the first 3 digits of the 9-digit LOCAL form (after stripping country code/leading 0).
 * e.g. 0772123456 → local "772123456" → prefix "772"
 *
 * MTN   : 772, 782, 762, 312, 392  (i.e. 077x, 078x, 076x, 031x, 039x)
 * Airtel: 702, 752, 742, 202        (i.e. 070x, 075x, 074x, 020x)
 */
const MTN_PREFIXES = new Set(["772", "782", "762", "312", "392"]);
const AIRTEL_PREFIXES = new Set(["702", "752", "742", "202"]);

/**
 * Strip a Uganda phone number to its 9-digit local form.
 * Accepts: 0XXXXXXXXX | +256XXXXXXXXX | 256XXXXXXXXX | XXXXXXXXX
 * Returns null for anything structurally invalid.
 */
export function normalizeUgandaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("256") && digits.length === 12) return digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits.slice(1);
  if (digits.length === 9) return digits;

  return null;
}

/**
 * Detect the mobile money network for a Uganda phone number.
 * Accepts any format supported by normalizeUgandaPhone().
 */
export function detectUgandaNetwork(phone: string): UgandaNetwork | null {
  const local = normalizeUgandaPhone(phone);
  if (!local) return null;

  const prefix = local.slice(0, 3);
  if (MTN_PREFIXES.has(prefix)) return "MTN";
  if (AIRTEL_PREFIXES.has(prefix)) return "AIRTEL";
  return null;
}

/**
 * Validate a Uganda phone number and return structured info.
 * This is the single entry-point you'll use in the SDK.
 *
 * @example
 * const r = validateUgandaPhone("0772123456");
 * // { valid: true, normalized: "772123456", network: "MTN", e164: "+256772123456" }
 */
export function validateUgandaPhone(phone: string): PhoneValidationResult {
  const normalized = normalizeUgandaPhone(phone);

  if (!normalized) {
    return {
      valid: false,
      error: `Invalid Uganda phone format "${phone}". ` +
        `Expected 0XXXXXXXXX, +256XXXXXXXXX, or 9-digit local.`,
    };
  }

  const network = detectUgandaNetwork(normalized);
  if (!network) {
    const prefix = `0${normalized.slice(0, 2)}`; // e.g. "77" → display as "077x"
    return {
      valid: false,
      normalized,
      error:
        `Unrecognised Uganda prefix "${prefix}x" for "${phone}". ` +
        `MTN: 077x/078x/076x/031x/039x · Airtel: 070x/075x/074x/020x`,
    };
  }

  return {
    valid: true,
    normalized,
    network,
    e164: `+256${normalized}`,
  };
}
