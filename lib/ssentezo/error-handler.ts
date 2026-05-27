// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Error Handler Utility
//
//  Eliminates the repetitive try/catch chains that every route handler,
//  Server Action, and service function would otherwise need to write.
//
//  Three flavours:
//
//  1. handleSsentezoError(err)
//     Classifies any thrown value into a typed SsentezoErrorResult.
//     Use this when you want to inspect the result yourself before returning.
//
//  2. withSsentezo(fn)
//     Wraps an async function. Returns { data } on success or { error } on
//     any Ssentezo (or unexpected) error. Perfect for Server Actions that
//     must never throw to the client.
//
//  3. handleSsentezoRouteError(err)
//     Returns a NextResponse JSON error already formatted for a Route Handler.
//     Import NextResponse from "next/server" before using this flavour.
// ─────────────────────────────────────────────

import {
  SsentezoAuthError,
  SsentezoError,
  SsentezoNetworkError,
  SsentezoRateLimitError,
  SsentezoTimeoutError,
  SsentezoValidationError,
} from "./errors.js";

// ── Shared result type ────────────────────────────────────────────────────────

/**
 * Discriminated union returned by `handleSsentezoError`.
 *
 * Narrow by checking `result.kind`:
 *
 * ```ts
 * const result = handleSsentezoError(err);
 * if (result.kind === "validation") {
 *   // result.fieldErrors is available here
 * }
 * ```
 */
export type SsentezoErrorResult =
  | {
      kind: "validation";
      message: string;
      /** Field-level messages, e.g. `{ amount: ["must be at least 500"] }` */
      fieldErrors: Record<string, string[]> | undefined;
      /** Suggested HTTP status to return to your client. */
      httpStatus: 422;
    }
  | {
      kind: "auth";
      message: string;
      /** Generic message safe to return to the browser. */
      publicMessage: "Service configuration error.";
      httpStatus: 401 | 403;
    }
  | {
      kind: "rateLimit";
      message: string;
      publicMessage: "Too many requests. Please try again shortly.";
      httpStatus: 429;
    }
  | {
      kind: "timeout";
      message: string;
      publicMessage: "Payment request timed out. Please retry.";
      /** Configured timeout in ms, if available. */
      timeoutMs: number | undefined;
      httpStatus: 504;
    }
  | {
      kind: "network";
      message: string;
      publicMessage: "Could not reach the payment service. Please retry.";
      httpStatus: 503;
    }
  | {
      kind: "api";
      message: string;
      /** Machine-readable code from the Ssentezo API, e.g. "UPPER_CEILING_BREACH". */
      code: string | undefined;
      httpStatus: number;
    }
  | {
      kind: "unknown";
      message: string;
      /** The original thrown value for server-side logging. */
      cause: unknown;
      httpStatus: 500;
    };

// ── Core classifier ───────────────────────────────────────────────────────────

/**
 * Classify any thrown value into a typed `SsentezoErrorResult`.
 *
 * This is the building block used by `withSsentezo` and
 * `handleSsentezoRouteError`. Use it directly when you need to branch on
 * `result.kind` before deciding what to return.
 *
 * @example
 * } catch (err) {
 *   const result = handleSsentezoError(err);
 *   if (result.kind === "validation") {
 *     return { error: result.message, fields: result.fieldErrors };
 *   }
 *   if (result.kind === "auth") {
 *     console.error("[Ssentezo] Credential problem:", result.message);
 *     return { error: result.publicMessage };
 *   }
 *   return { error: result.publicMessage ?? result.message };
 * }
 */
export function handleSsentezoError(err: unknown): SsentezoErrorResult {
  // ── Validation (422 / client-side) ────────────────────────────────────────
  if (err instanceof SsentezoValidationError) {
    return {
      kind:        "validation",
      message:     err.message,
      fieldErrors: err.fieldErrors,
      httpStatus:  422,
    };
  }

  // ── Auth (401 / 403) ──────────────────────────────────────────────────────
  if (err instanceof SsentezoAuthError) {
    // Log the real message server-side; return a safe public message to clients
    console.error("[Ssentezo] Auth error:", err.message);
    return {
      kind:          "auth",
      message:       err.message,
      publicMessage: "Service configuration error.",
      httpStatus:    err.statusCode as 401 | 403,
    };
  }

  // ── Rate limit (429) ──────────────────────────────────────────────────────
  if (err instanceof SsentezoRateLimitError) {
    return {
      kind:          "rateLimit",
      message:       err.message,
      publicMessage: "Too many requests. Please try again shortly.",
      httpStatus:    429,
    };
  }

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (err instanceof SsentezoTimeoutError) {
    return {
      kind:          "timeout",
      message:       err.message,
      publicMessage: "Payment request timed out. Please retry.",
      timeoutMs:     err.timeoutMs,
      httpStatus:    504,
    };
  }

  // ── Network ───────────────────────────────────────────────────────────────
  if (err instanceof SsentezoNetworkError) {
    return {
      kind:          "network",
      message:       err.message,
      publicMessage: "Could not reach the payment service. Please retry.",
      httpStatus:    503,
    };
  }

  // ── Generic Ssentezo API error ────────────────────────────────────────────
  if (err instanceof SsentezoError) {
    return {
      kind:       "api",
      message:    err.message,
      code:       err.code,
      httpStatus: err.statusCode ?? 500,
    };
  }

  // ── Unexpected / non-Ssentezo error ──────────────────────────────────────
  console.error("[Ssentezo] Unexpected error:", err);
  return {
    kind:       "unknown",
    message:    err instanceof Error ? err.message : "An unexpected error occurred.",
    cause:      err,
    httpStatus: 500,
  };
}

// ── publicMessage helper ──────────────────────────────────────────────────────

/**
 * Extract the safest message to return to the browser for a given result.
 *
 * - `validation` → the full message (it describes bad input, not internals)
 * - `api`        → the message from the Ssentezo API
 * - everything else → a short, non-leaking public message
 *
 * @example
 * const result = handleSsentezoError(err);
 * return NextResponse.json(
 *   { error: publicMessage(result) },
 *   { status: result.httpStatus }
 * );
 */
export function publicMessage(result: SsentezoErrorResult): string {
  switch (result.kind) {
    case "validation": return result.message;
    case "api":        return result.message;
    case "auth":       return result.publicMessage;
    case "rateLimit":  return result.publicMessage;
    case "timeout":    return result.publicMessage;
    case "network":    return result.publicMessage;
    case "unknown":    return "An unexpected payment error occurred.";
  }
}

// ── withSsentezo — wraps any async fn ────────────────────────────────────────

/**
 * Wrap an async Ssentezo operation so it never throws to the caller.
 * Returns a discriminated union of `{ data }` on success or `{ error }` on failure.
 *
 * Ideal for **Server Actions**, which must return serialisable values and
 * must never propagate exceptions to the browser.
 *
 * @example
 * // Server Action
 * export async function collectPayment(msisdn: string, amount: number) {
 *   return withSsentezo(() =>
 *     wallet.transactions.deposit({ externalReference: generateReference(), msisdn, amount, reason: "Order" })
 *   );
 * }
 *
 * // Client Component
 * const result = await collectPayment("256709920188", 5000);
 * if (result.success) {
 *   console.log(result.data.ssentezoWalletReference);
 * } else {
 *   console.error(result.error, result.fieldErrors);
 * }
 */
export async function withSsentezo<T>(
  fn: () => Promise<T>
): Promise<SsentezoActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    const result = handleSsentezoError(err);
    return {
      success:     false,
      error:       publicMessage(result),
      kind:        result.kind,
      fieldErrors: result.kind === "validation" ? result.fieldErrors : undefined,
      code:        result.kind === "api" ? result.code : undefined,
    };
  }
}

/** Return type of `withSsentezo`. */
export type SsentezoActionResult<T> =
  | { success: true;  data: T }
  | {
      success:     false;
      error:       string;
      kind:        SsentezoErrorResult["kind"];
      fieldErrors: Record<string, string[]> | undefined;
      code:        string | undefined;
    };

// ── handleSsentezoRouteError — Route Handler shorthand ────────────────────────

/**
 * Build a `NextResponse` JSON error body directly from a caught error.
 *
 * Import `NextResponse` from `"next/server"` separately — this helper accepts
 * it as a parameter to avoid a hard dependency on `next` inside the SDK core.
 *
 * @example
 * import { NextResponse } from "next/server";
 * import { handleSsentezoRouteError } from "@/lib/ssentezo/error-handler";
 *
 * } catch (err) {
 *   return handleSsentezoRouteError(err, NextResponse);
 * }
 */
export function handleSsentezoRouteError(
  err: unknown,
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => unknown;
  }
): unknown {
  const result = handleSsentezoError(err);

  const body: Record<string, unknown> = {
    error: publicMessage(result),
    kind:  result.kind,
  };

  if (result.kind === "validation" && result.fieldErrors) {
    body.fieldErrors = result.fieldErrors;
  }
  if (result.kind === "api" && result.code) {
    body.code = result.code;
  }

  // Re-throw unknown errors so Next.js can handle them (500 page, Sentry, etc.)
  if (result.kind === "unknown") throw result.cause;

  return NextResponse.json(body, { status: result.httpStatus });
}
