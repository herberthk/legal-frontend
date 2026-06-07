// ─────────────────────────────────────────────────────────────────────────────
// payload.ts — Build Flutterwave v4 orchestrator request payloads
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MobileMoneyChargeInput,
  CardChargeInput,
  BankChargeInput,
  EncryptedCardDetails,
  CustomerInfo,
  AuthorizationInput,
} from "./";
import { validateUgandaPhone } from "./";
import { FlwUgSdkError } from "./";

const COUNTRY_CODE = "256"; // Uganda

// ── Customer sub-object ───────────────────────────────────────────────────────

function buildCustomer(c: CustomerInfo): Record<string, unknown> {
  const customer: Record<string, unknown> = {
    email: c.email,
    name: {
      first: c.firstName,
      last: c.lastName,
      ...(c.middleName ? { middle: c.middleName } : {}),
    },
  };

  if (c.phone) {
    const v = validateUgandaPhone(c.phone);
    if (!v.valid) {
      throw new FlwUgSdkError({
        code: "INVALID_PHONE",
        message: v.error!,
      });
    }
    customer["phone"] = { country_code: COUNTRY_CODE, number: v.normalized };
  }

  return customer;
}

// ── Mobile money ──────────────────────────────────────────────────────────────

export function buildMobileMoneyPayload(
  input: MobileMoneyChargeInput,
  chargeAmount: number,
  reference: string,
  callbackUrl?: string,
  redirectUrl?: string,
): Record<string, unknown> {
  const v = validateUgandaPhone(input.phoneNumber);
  if (!v.valid) {
    throw new FlwUgSdkError({ code: "INVALID_PHONE", message: v.error! });
  }

  const network = input.network ?? v.network;
  if (!network) {
    throw new FlwUgSdkError({
      code: "INVALID_NETWORK",
      message: `Could not detect network for ${input.phoneNumber}. Pass network: "MTN" or "AIRTEL" explicitly.`,
    });
  }

  return {
    amount: chargeAmount,
    currency: "UGX",
    reference,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    ...(input.narration ? { narration: input.narration } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    customer: buildCustomer(input.customer),
    payment_method: {
      type: "mobile_money",
      mobile_money: {
        country_code: COUNTRY_CODE,
        network,
        phone_number: v.normalized,
      },
    },
  };
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function buildCardPayload(
  input: CardChargeInput,
  encrypted: EncryptedCardDetails,
  chargeAmount: number,
  reference: string,
  callbackUrl?: string,
  redirectUrl?: string,
): Record<string, unknown> {
  return {
    amount: chargeAmount,
    currency: "UGX",
    reference,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    ...(input.narration ? { narration: input.narration } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    customer: buildCustomer(input.customer),
    payment_method: {
      type: "card",
      card: encrypted,
    },
  };
}

// ── Bank (USSD) ───────────────────────────────────────────────────────────────

export function buildBankPayload(
  input: BankChargeInput,
  chargeAmount: number,
  reference: string,
  callbackUrl?: string,
  redirectUrl?: string,
): Record<string, unknown> {
  return {
    amount: chargeAmount,
    currency: "UGX",
    reference,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
    ...(input.narration ? { narration: input.narration } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    customer: buildCustomer(input.customer),
    payment_method: {
      type: "ussd",
      ussd: {
        account_bank: input.accountBank,
      },
    },
  };
}

// ── Authorization update payload ──────────────────────────────────────────────

export function buildAuthorizationPayload(
  auth: AuthorizationInput,
  encryptField?: (value: string) => Promise<string>,
  nonce?: string,
): Promise<Record<string, unknown>> | Record<string, unknown> {
  if (auth.type === "otp") {
    return {
      authorization: {
        type: "otp",
        otp: { code: auth.code },
      },
    };
  }

  if (auth.type === "avs") {
    return {
      authorization: {
        type: "avs",
        avs: {
          address: {
            city: auth.address.city,
            country: auth.address.country,
            line1: auth.address.line1,
            ...(auth.address.line2 ? { line2: auth.address.line2 } : {}),
            postal_code: auth.address.postalCode,
            state: auth.address.state,
          },
        },
      },
    };
  }

  // PIN — must encrypt before sending
  if (auth.type === "pin") {
    if (!encryptField || !nonce) {
      throw new FlwUgSdkError({
        code: "MISSING_ENCRYPTION_KEY",
        message: "encryptionKey is required in config to authorize with PIN.",
      });
    }
    return encryptField(auth.pin).then((encryptedPin) => ({
      authorization: {
        type: "pin",
        pin: { nonce, encrypted_pin: encryptedPin },
      },
    }));
  }

  throw new FlwUgSdkError({
    code: "UNKNOWN",
    message: `Unknown authorization type: ${(auth as AuthorizationInput).type}`,
  });
}
