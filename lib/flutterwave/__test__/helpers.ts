// tests/helpers.ts — Shared fixtures, mock factories, and fetch stubbing utilities

import { vi } from "vitest";
import type { ApiResponse } from "../";

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const VALID_TOKEN_RESPONSE = {
  access_token: "test-access-token-abc123",
  expires_in: 600, // 10 minutes
  token_type: "Bearer",
};

export const SDK_CONFIG = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  // 32 raw bytes (256 bits) base64-encoded — valid AES-256 key for crypto tests
  encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  environment: "sandbox" as const,
  timeoutMs: 5_000,
};

export const CUSTOMER = {
  email: "john.mukasa@example.com",
  firstName: "John",
  lastName: "Mukasa",
  phone: "0772123456",
};

export const RAW_CARD = {
  cardNumber: "4111111111111111",
  expiryMonth: "01",
  expiryYear: "26",
  cvv: "123",
};

export const RAW_CHARGE_PENDING = {
  id: "chg_001",
  reference: "LGL-TEST-001",
  status: "pending" as const,
  amount: 10_150,
  currency: "UGX",
  fees: [{ type: "app", amount: 150 }],
  next_action: {
    type: "payment_instruction",
    payment_instruction: { note: "Approve on your phone." },
  },
  created_datetime: "2026-01-01T10:00:00Z",
};

export const RAW_CHARGE_REQUIRES_PIN = {
  id: "chg_002",
  reference: "LGL-TEST-002",
  status: "pending" as const,
  amount: 51_000,
  currency: "UGX",
  fees: [{ type: "app", amount: 1_000 }],
  next_action: { type: "requires_pin" },
  created_datetime: "2026-01-01T10:00:00Z",
};

export const RAW_CHARGE_REDIRECT = {
  id: "chg_003",
  reference: "LGL-TEST-003",
  status: "pending" as const,
  amount: 25_100,
  currency: "UGX",
  fees: [{ type: "app", amount: 100 }],
  next_action: { type: "redirect", redirect_url: "https://3ds.bank.ug/auth" },
  created_datetime: "2026-01-01T10:00:00Z",
};

export const RAW_VERIFY_SUCCESSFUL = {
  id: "chg_001",
  reference: "LGL-TEST-001",
  status: "successful" as const,
  amount: 10_150,
  currency: "UGX",
  customer_id: "cust_abc",
  payment_method_id: "pm_xyz",
  updated_datetime: "2026-01-01T10:05:00Z",
};

export const RAW_FEE_RESPONSE = {
  charge_amount: 10_150,
  fee: 150,
  merchantfee: 0,
  ravefee: 150,
};

// ── Fetch mock factory ────────────────────────────────────────────────────────

/**
 * Build a fetch mock that returns token first, then API responses in order.
 * Automatically wraps API payloads in { status: "success", data: payload }.
 */
export function mockFetchSequence(
  ...responses: Array<unknown>
): ReturnType<typeof vi.fn> {
  let callCount = 0;
  return vi.fn().mockImplementation(async (url: string) => {
    const resp = responses[callCount++] ?? responses[responses.length - 1];

    // Token endpoint returns raw JSON (not wrapped in ApiResponse)
    const isTokenUrl = typeof url === "string" && url.includes("openid-connect/token");

    const body = isTokenUrl
      ? resp
      : ({ status: "success", message: "ok", data: resp } satisfies ApiResponse<unknown>);

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/**
 * Build a fetch mock that returns token first, then a single API error response.
 */
export function mockFetchError(
  httpStatus: number,
  errorBody: Partial<ApiResponse<never>> = {}
): ReturnType<typeof vi.fn> {
  let callCount = 0;
  return vi.fn().mockImplementation(async (url: string) => {
    const isTokenUrl = typeof url === "string" && url.includes("openid-connect/token");
    if (isTokenUrl) {
      // Always succeed on token request
      callCount++;
      return new Response(JSON.stringify(VALID_TOKEN_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    callCount++;
    const body: ApiResponse<never> = {
      status: "error",
      message: "Bad request",
      ...errorBody,
    };
    return new Response(JSON.stringify(body), {
      status: httpStatus,
      headers: { "Content-Type": "application/json" },
    });
  });
}

/**
 * Build a fetch mock that aborts (simulates timeout / network drop).
 */
export function mockFetchAbort(): ReturnType<typeof vi.fn> {
  let callCount = 0;
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const isTokenUrl = typeof url === "string" && url.includes("openid-connect/token");
    if (isTokenUrl && callCount === 0) {
      callCount++;
      return new Response(JSON.stringify(VALID_TOKEN_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Simulate abort signal being triggered
    if (init?.signal) {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      throw err;
    }
    throw new Error("Network error");
  });
}
