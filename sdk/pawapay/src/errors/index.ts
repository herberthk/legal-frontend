// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Errors
// ─────────────────────────────────────────────────────────────────────────────

import type { FailureReason } from "../types";

/**
 * Base class for all PawaPay SDK errors.
 * Extends native Error so `instanceof PawaPayError` works across module
 * boundaries when using ES modules.
 */
export class PawaPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PawaPayError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the HTTP response status indicates an API-level error
 * (4xx / 5xx) and the body carries a structured failureReason.
 */
export class PawaPayApiError extends PawaPayError {
  public readonly httpStatus: number;
  public readonly failureCode: string;
  public readonly failureMessage: string;
  public readonly requestId?: string;

  constructor(
    httpStatus: number,
    failureReason: FailureReason,
    requestId?: string
  ) {
    super(
      `[${httpStatus}] ${failureReason.failureCode}: ${failureReason.failureMessage}`
    );
    this.name = "PawaPayApiError";
    this.httpStatus = httpStatus;
    this.failureCode = failureReason.failureCode;
    this.failureMessage = failureReason.failureMessage;
    this.requestId = requestId;
    Object.setPrototypeOf(this, PawaPayApiError.prototype);
  }

  get isAuthError(): boolean {
    return this.httpStatus === 401 || this.httpStatus === 403;
  }

  get isRateLimitError(): boolean {
    return this.httpStatus === 429;
  }

  get isServerError(): boolean {
    return this.httpStatus >= 500;
  }
}

/**
 * Thrown when the network request itself fails (timeout, DNS failure, etc.)
 * or when the response body cannot be parsed as JSON.
 */
export class PawaPayNetworkError extends PawaPayError {
  public override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PawaPayNetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, PawaPayNetworkError.prototype);
  }
}

/**
 * Thrown when client-side validation of request parameters fails before
 * the request is even sent, saving a round-trip.
 */
export class PawaPayValidationError extends PawaPayError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "PawaPayValidationError";
    this.field = field;
    Object.setPrototypeOf(this, PawaPayValidationError.prototype);
  }
}

/**
 * Thrown when all retry attempts are exhausted without a successful response.
 */
export class PawaPayRetryExhaustedError extends PawaPayError {
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    super(`All ${attempts} retry attempt(s) exhausted.`);
    this.name = "PawaPayRetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
    Object.setPrototypeOf(this, PawaPayRetryExhaustedError.prototype);
  }
}
