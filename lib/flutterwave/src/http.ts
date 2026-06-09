// ─────────────────────────────────────────────────────────────────────────────
// http.ts — OAuth2 token manager + fetch wrapper with timeout & error shaping
// ─────────────────────────────────────────────────────────────────────────────

import type { FlwUgError } from "./";

// ── Error class ───────────────────────────────────────────────────────────────

/** Strongly-typed SDK error. Thrown on every failure path. */
export class FlwUgSdkError extends Error {
  constructor(public readonly sdkError: FlwUgError) {
    super(sdkError.message);
    this.name = "FlwUgSdkError";
  }
}

// ── Token manager ─────────────────────────────────────────────────────────────

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

/** Minimum seconds remaining before we proactively refresh. */
const REFRESH_THRESHOLD_SECS = 60;

interface TokenState {
  accessToken: string;
  /** Unix timestamp (ms) when the token expires */
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

/**
 * Manages a single OAuth2 access token per SDK instance.
 * Fetches on first use, auto-refreshes when < 60 s remain.
 * Thread-safe: concurrent callers share the same in-flight fetch promise.
 */
export class TokenManager {
  private state: TokenState | null = null;
  private inflightFetch: Promise<TokenState> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly timeoutMs: number
  ) {}

  /** Returns a valid access token, fetching/refreshing as needed. */
  async getToken(): Promise<string> {
    const now = Date.now();

    // Token is valid and has > REFRESH_THRESHOLD_SECS remaining
    if (
      this.state &&
      this.state.expiresAt - now > REFRESH_THRESHOLD_SECS * 1000
    ) {
      return this.state.accessToken;
    }

    // De-duplicate concurrent refresh calls
    if (!this.inflightFetch) {
      this.inflightFetch = this.fetchToken().finally(() => {
        this.inflightFetch = null;
      });
    }

    this.state = await this.inflightFetch;
    return this.state.accessToken;
  }

  private async fetchToken(): Promise<TokenState> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new FlwUgSdkError({
        code: isAbort ? "TIMEOUT" : "TOKEN_FETCH_FAILED",
        message: isAbort
          ? `Token request timed out after ${this.timeoutMs}ms`
          : `Failed to fetch OAuth2 token: ${(err as Error).message}`,
        raw: err,
      });
    }
    clearTimeout(timer);

    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { body = null; }
      throw new FlwUgSdkError({
        code: "TOKEN_FETCH_FAILED",
        message: `OAuth2 token request failed with HTTP ${res.status}`,
        httpStatus: res.status,
        raw: body,
      });
    }

    const data = (await res.json()) as TokenResponse;
// console.log('access token:', data.access_token);
    return {
      accessToken: data.access_token,
      // Subtract 5 s buffer to account for clock skew
      expiresAt: Date.now() + (data.expires_in - 5) * 1000,
    };
  }
}

// ── API response shape ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: "success" | "error" | "failed";
  message: string;
  data?: T;
  error?: {
    type: string;
    code: string;
    message: string;
    validation_errors?: unknown[];
  };
}

// ── Core request helper ───────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Make an authenticated API request.
 * - Resolves the current access token from TokenManager before each call
 * - Attaches X-Trace-Id + X-Idempotency-Key
 * - Enforces AbortController timeout
 * - Shapes every error path into FlwUgSdkError
 */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT",
  url: string,
  tokenManager: TokenManager,
  body?: unknown,
  timeoutMs = 30_000
): Promise<T> {
  const accessToken = await tokenManager.getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Trace-Id": generateId(),
  };
  if (method !== "GET") {
    headers["X-Idempotency-Key"] = generateId();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new FlwUgSdkError({
      code: isAbort ? "TIMEOUT" : "API_ERROR",
      message: isAbort
        ? `Request timed out after ${timeoutMs}ms`
        : `Network error: ${(err as Error).message}`,
      raw: err,
    });
  }
  clearTimeout(timer);

  let json: ApiResponse<T> | null;
  try {
    json = (await res.json()) as ApiResponse<T> | null;
  } catch {
    throw new FlwUgSdkError({
      code: "API_ERROR",
      message: `HTTP ${res.status}: response was not valid JSON`,
      httpStatus: res.status,
    });
  }

  // Guard: some error responses parse to null
  if (!json) {
    throw new FlwUgSdkError({
      code: "API_ERROR",
      message: `HTTP ${res.status}: empty response body`,
      httpStatus: res.status,
    });
  }

  if (!res.ok || json.status === "error" || json.status === "failed") {
    throw new FlwUgSdkError({
      code: "API_ERROR",
      message: json.error?.message ?? json.message ?? `HTTP ${res.status}`,
      httpStatus: res.status,
      raw: json,
    });
  }

  return json.data as T;
}
