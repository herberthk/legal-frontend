// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures & Mock Helpers
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from "vitest";
import type {
  DepositRequest,
  PayoutRequest,
  RefundRequest,
  RemittanceRequest,
  DepositInitiationResponse,
  DepositStatusResponse,
  PayoutInitiationResponse,
  PayoutStatusResponse,
  RefundInitiationResponse,
  RefundStatusResponse,
} from "../src/types";
import { TransactionStatus } from "../src/types";

// ── Stable IDs for reuse across tests ────────────────────────────────────────

export const DEPOSIT_ID   = "a1b2c3d4-e5f6-4789-abcd-ef0123456789";
export const PAYOUT_ID    = "b2c3d4e5-f6a7-4890-bcde-f01234567890";
export const REFUND_ID    = "c3d4e5f6-a7b8-4901-8def-012345678901";
export const REMIT_ID     = "d4e5f6a7-b8c9-4012-9efa-123456789012";
export const STATEMENT_ID = "e5f6a7b8-c9d0-4123-8fab-234567890123";

// ── Phone numbers ─────────────────────────────────────────────────────────────

export const MTN_UGA_PHONE   = "256700123456";
export const AIRTEL_UGA_PHONE = "256751123456";
export const ZMB_PHONE       = "260971234567";

// ── Shared payer/recipient shapes ─────────────────────────────────────────────

export const ugaMtnPayer = {
  type: "MMO" as const,
  accountDetails: { phoneNumber: MTN_UGA_PHONE, provider: "MTN_MOMO_UGA" },
};

export const ugaAirtelRecipient = {
  type: "MMO" as const,
  accountDetails: { phoneNumber: AIRTEL_UGA_PHONE, provider: "AIRTEL_OAPI_UGA" },
};

// ── Request factories ─────────────────────────────────────────────────────────

export function makeDepositRequest(
  overrides: Partial<DepositRequest> = {}
): DepositRequest {
  return {
    depositId: DEPOSIT_ID,
    payer: ugaMtnPayer,
    amount: "5000",
    currency: "UGX",
    ...overrides,
  };
}

export function makePayoutRequest(
  overrides: Partial<PayoutRequest> = {}
): PayoutRequest {
  return {
    payoutId: PAYOUT_ID,
    recipient: ugaAirtelRecipient,
    amount: "10000",
    currency: "UGX",
    ...overrides,
  };
}

export function makeRefundRequest(
  overrides: Partial<RefundRequest> = {}
): RefundRequest {
  return {
    refundId: REFUND_ID,
    depositId: DEPOSIT_ID,
    amount: "5000",
    currency: "UGX",
    ...overrides,
  };
}

export function makeRemittanceRequest(
  overrides: Partial<RemittanceRequest> = {}
): RemittanceRequest {
  return {
    remittanceId: REMIT_ID,
    recipient: ugaMtnPayer,
    amount: "50000",
    currency: "UGX",
    ...overrides,
  };
}

// ── Response factories ────────────────────────────────────────────────────────

export function makeDepositAccepted(
  id = DEPOSIT_ID
): DepositInitiationResponse {
  return {
    depositId: id,
    status: TransactionStatus.ACCEPTED,
    created: "2024-06-01T10:00:00Z",
  };
}

export function makeDepositCompleted(id = DEPOSIT_ID): DepositStatusResponse {
  return {
    depositId: id,
    status: TransactionStatus.ACCEPTED,
    finalStatus: "COMPLETED",
    created: "2024-06-01T10:00:00Z",
    amount: "5000",
    currency: "UGX",
    country: "UGA",
    payer: ugaMtnPayer,
  };
}

export function makeDepositFailed(id = DEPOSIT_ID): DepositStatusResponse {
  return {
    depositId: id,
    status: TransactionStatus.REJECTED,
    finalStatus: "FAILED",
    created: "2024-06-01T10:00:00Z",
    failureReason: {
      failureCode: "INVALID_PHONE_NUMBER",
      failureMessage: "The phone number is not valid.",
    },
  };
}

export function makePayoutAccepted(id = PAYOUT_ID): PayoutInitiationResponse {
  return {
    payoutId: id,
    status: TransactionStatus.ACCEPTED,
    created: "2024-06-01T11:00:00Z",
  };
}

export function makePayoutCompleted(id = PAYOUT_ID): PayoutStatusResponse {
  return {
    payoutId: id,
    status: TransactionStatus.ACCEPTED,
    finalStatus: "COMPLETED",
    amount: "10000",
    currency: "UGX",
    country: "UGA",
  };
}

export function makeRefundAccepted(id = REFUND_ID): RefundInitiationResponse {
  return {
    refundId: id,
    status: TransactionStatus.ACCEPTED,
    created: "2024-06-01T12:00:00Z",
  };
}

export function makeRefundCompleted(id = REFUND_ID): RefundStatusResponse {
  return {
    refundId: id,
    status: TransactionStatus.ACCEPTED,
    finalStatus: "COMPLETED",
    amount: "5000",
    currency: "UGX",
  };
}

// ── Fetch mock factory ────────────────────────────────────────────────────────

/**
 * Creates a mock fetch function that returns a JSON response.
 * Use `vi.fn()` so tests can assert call counts and arguments.
 */
export function mockFetch(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    })
  );
}

/**
 * Creates a fetch mock that fails on the first `failCount` calls then
 * succeeds. Used for retry testing.
 */
export function mockFetchWithRetries(
  successBody: unknown,
  failCount: number,
  failStatus = 503
): ReturnType<typeof vi.fn> {
  let calls = 0;
  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls <= failCount) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            failureReason: {
              failureCode: "PROVIDER_TEMPORARILY_UNAVAILABLE",
              failureMessage: "Service temporarily unavailable.",
            },
          }),
          {
            status: failStatus,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(successBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
}

/**
 * Creates a fetch mock that always rejects with a network-level TypeError.
 */
export function mockFetchNetworkFailure(message = "fetch failed"): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new TypeError(message));
}

/**
 * Creates a fetch mock that returns a non-JSON response.
 */
export function mockFetchNonJson(status = 500): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response("Internal Server Error", {
      status,
      headers: { "Content-Type": "text/plain" },
    })
  );
}

/**
 * Creates a fetch mock that returns 204 No Content (no body).
 */
export function mockFetch204(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(null, { status: 204, headers: {} })
  );
}
