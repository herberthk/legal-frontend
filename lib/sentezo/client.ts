// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — HTTP Client
// ─────────────────────────────────────────────

import {
  SsentezoAuthError,
  SsentezoError,
  SsentezoNetworkError,
  SsentezoRateLimitError,
  SsentezoTimeoutError,
  SsentezoValidationError,
} from "./errors";
import type { SsentezoConfig, SsentezoRawResponse } from "./types";
import { base64Encode, retryDelay, sleep } from "./utils";

// ── Constants ─────────────────────────────────────────────────────────────────

export const LIVE_BASE_URL    = "https://wallet.ssentezo.com/api";
export const SANDBOX_BASE_URL = "https://devwallet.ssentezo.com/api";

const DEFAULT_TIMEOUT_MS  = 30_000; // 30 s
const DEFAULT_MAX_RETRIES = 3;

/**
 * HTTP status codes that are safe to retry automatically.
 * 4xx auth/validation errors are NOT retried — they require code changes.
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Low-level HTTP client.
 * Handles authentication, JSON serialization, timeout, and retry with
 * full-jitter exponential back-off.
 *
 * You should not use this class directly — prefer the high-level
 * `SsentezoWallet` class exported from `index.ts`.
 */
export class SsentezoClient {
  readonly baseUrl: string;

  private readonly authHeader: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(
    config: Required<Pick<SsentezoConfig, "apiUser" | "apiKey">> &
      SsentezoConfig
  ) {
    this.baseUrl =
      config.environment === "sandbox" ? SANDBOX_BASE_URL : LIVE_BASE_URL;
    this.authHeader = `Basic ${base64Encode(`${config.apiUser}:${config.apiKey}`)}`;
    this.timeoutMs  = config.timeout    ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Execute a POST request to a Ssentezo endpoint.
   *
   * @param path   Path relative to the base URL (e.g. "/acc_balance").
   * @param body   JSON body. Omit for endpoints that take no payload.
   * @returns      The `data` field from a successful `{ response: "OK" }` envelope.
   * @throws       {SsentezoError} (or a subclass) on any error.
   */
  async post<T>(
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 1; ; attempt++) {
      // ── Fetch with timeout ────────────────────────────────────────────────
      let response: Response;

      try {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          this.timeoutMs
        );

        response = await fetch(url, {
          method:  "POST",
          headers: {
            Authorization:  this.authHeader,
            "Content-Type": "application/json",
            // Hint to the HTTP layer that we want persistent connections
            Connection: "keep-alive",
          },
          body:   body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          // Next.js App Router: never cache financial API responses
          cache:  "no-store",
        });

        clearTimeout(timer);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new SsentezoTimeoutError(this.timeoutMs);
        }
        // Network-level error — retry if attempts remain
        if (attempt <= this.maxRetries) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new SsentezoNetworkError(
          err instanceof Error ? err.message : String(err),
          err
        );
      }

      // ── Auth errors — never retry ─────────────────────────────────────────
      if (response.status === 401 || response.status === 403) {
        throw new SsentezoAuthError(response.status as 401 | 403);
      }

      // ── Retryable errors ──────────────────────────────────────────────────
      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        if (attempt <= this.maxRetries) {
          await sleep(retryDelay(attempt));
          continue;
        }
        // Out of retries
        if (response.status === 429) throw new SsentezoRateLimitError();
      }

      // ── Parse JSON ────────────────────────────────────────────────────────
      let json: SsentezoRawResponse<T>;
      try {
        json = (await response.json()) as SsentezoRawResponse<T>;
      } catch {
        throw new SsentezoNetworkError(
          `Failed to parse JSON response from ${path} (HTTP ${response.status}).`
        );
      }

      // ── Handle API-level errors ───────────────────────────────────────────
      if (json.response === "ERROR") {
        const { message, code, errors } = json.error;

        if (response.status === 422) {
          throw new SsentezoValidationError(message, errors);
        }
        throw new SsentezoError(message, code, response.status);
      }

      return json.data;
    }
  }
}
