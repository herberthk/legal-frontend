// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Errors
// ─────────────────────────────────────────────

/**
 * Base error class for all Ssentezo SDK errors.
 * Always check `instanceof SsentezoError` before narrowing to a subclass.
 */
export class SsentezoError extends Error {
  /** Machine-readable code from the API or the SDK itself. */
  readonly code: string | undefined;
  /** HTTP status code of the failed response, if applicable. */
  readonly statusCode: number | undefined;
  /** Field-level validation messages from a 422 response. */
  readonly fieldErrors: Record<string, string[]> | undefined;

  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "SsentezoError";
    this.code = code;
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
    // Ensure correct prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown on HTTP 401 (missing Authorization header) or
 * HTTP 403 (invalid credentials).
 *
 * Check that SSENTEZO_API_USER and SSENTEZO_API_KEY are set correctly.
 */
export class SsentezoAuthError extends SsentezoError {
  constructor(statusCode: 401 | 403) {
    super(
      statusCode === 401
        ? "Missing Authorization header. Verify that credentials are provided."
        : "Invalid API credentials. Check your SSENTEZO_API_USER and SSENTEZO_API_KEY.",
      "AUTH_ERROR",
      statusCode
    );
    this.name = "SsentezoAuthError";
  }
}

/**
 * Thrown when the API returns HTTP 429 and all retry attempts are exhausted.
 *
 * Implement exponential back-off and avoid tight polling loops.
 */
export class SsentezoRateLimitError extends SsentezoError {
  constructor() {
    super(
      "Rate limit exceeded. Implement exponential back-off and avoid polling tight loops.",
      "RATE_LIMIT_EXCEEDED",
      429
    );
    this.name = "SsentezoRateLimitError";
  }
}

/**
 * Thrown on HTTP 422 (Unprocessable Entity) or when the SDK's own validators
 * reject a parameter before the request is sent.
 *
 * Check `fieldErrors` for per-field messages returned by the API.
 */
export class SsentezoValidationError extends SsentezoError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, "VALIDATION_ERROR", 422, fieldErrors);
    this.name = "SsentezoValidationError";
  }
}

/**
 * Thrown when a `fetch` call fails at the network level (DNS, TCP, etc.)
 * after all retries are exhausted.
 */
export class SsentezoNetworkError extends SsentezoError {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(`Network error: ${message}`, "NETWORK_ERROR");
    this.name = "SsentezoNetworkError";
    this.cause = cause;
  }
}

/**
 * Thrown when a request exceeds the configured `timeout` (default: 30 s).
 */
export class SsentezoTimeoutError extends SsentezoError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `Request timed out after ${timeoutMs} ms. Consider increasing the timeout option.`,
      "TIMEOUT"
    );
    this.name = "SsentezoTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isSsentezoError(err: unknown): err is SsentezoError {
  return err instanceof SsentezoError;
}

export function isSsentezoAuthError(err: unknown): err is SsentezoAuthError {
  return err instanceof SsentezoAuthError;
}

export function isSsentezoRateLimitError(
  err: unknown
): err is SsentezoRateLimitError {
  return err instanceof SsentezoRateLimitError;
}

export function isSsentezoValidationError(
  err: unknown
): err is SsentezoValidationError {
  return err instanceof SsentezoValidationError;
}

export function isSsentezoNetworkError(
  err: unknown
): err is SsentezoNetworkError {
  return err instanceof SsentezoNetworkError;
}
