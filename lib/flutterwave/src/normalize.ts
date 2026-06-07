// ─────────────────────────────────────────────────────────────────────────────
// normalize.ts — Map raw Flutterwave API responses → clean SDK types
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ChargeResult,
  NextAction,
  VerificationResult,
  ChargeStatus,
} from "./";
import { parseFees } from "./fees";

// Raw orchestrator charge response shape (internal)
interface RawChargeData {
  id: string;
  reference: string;
  status: ChargeStatus;
  amount: number;
  currency: string;
  fees?: Array<{ type: string; amount: number }>;
  next_action?: {
    type: string;
    redirect_url?: string;
    payment_instruction?: { note?: string };
    requires_pin?: unknown;
    requires_otp?: unknown;
    requires_additional_fields?: unknown;
    raw?: Record<string, unknown>;
  };
  created_datetime?: string;
}

// Raw verification response shape (internal)
interface RawVerifyData {
  id: string;
  reference: string;
  status: ChargeStatus;
  amount: number;
  currency: string;
  customer_id: string;
  payment_method_id: string;
  updated_datetime?: string;
}

/** Map next_action from API to our cleaner NextAction type */
function normalizeNextAction(raw?: RawChargeData["next_action"]): NextAction {
  if (!raw) return { type: "none" };

  const type = raw.type as NextAction["type"];

  switch (type) {
    case "redirect":
      return { type: "redirect", redirectUrl: raw.redirect_url, raw: raw as Record<string, unknown> };

    case "payment_instruction":
      return {
        type: "payment_instruction",
        instruction:
          raw.payment_instruction?.note ??
          "Please authorise this payment on your mobile device.",
        raw: raw as Record<string, unknown>,
      };

    case "requires_pin":
      return { type: "requires_pin", instruction: "Enter your card PIN to authorise this payment.", raw: raw as Record<string, unknown> };

    case "requires_otp":
      return { type: "requires_otp", instruction: "Enter the OTP sent to your registered phone/email.", raw: raw as Record<string, unknown> };

    case "requires_additional_fields":
      return { type: "requires_additional_fields", instruction: "Additional verification fields required.", raw: raw as Record<string, unknown> };

    default:
      return { type: "none", raw: raw as Record<string, unknown> };
  }
}

/** Normalize a raw orchestrator charge response into a ChargeResult */
export function normalizeChargeResponse(
  raw: RawChargeData,
  baseAmount: number
): ChargeResult {
  const fees = parseFees(baseAmount, raw.fees ?? []);

  return {
    chargeId: raw.id,
    reference: raw.reference,
    status: raw.status,
    chargeAmount: fees.chargeAmount,
    currency: "UGX",
    fees,
    nextAction: normalizeNextAction(raw.next_action),
    createdAt: raw.created_datetime ?? new Date().toISOString(),
  };
}

/** Normalize a raw verification response into a VerificationResult */
export function normalizeVerifyResponse(raw: RawVerifyData): VerificationResult {
  return {
    chargeId: raw.id,
    reference: raw.reference,
    status: raw.status,
    amount: raw.amount,
    currency: "UGX",
    customerId: raw.customer_id,
    paymentMethodId: raw.payment_method_id,
    updatedAt: raw.updated_datetime ?? new Date().toISOString(),
  };
}
