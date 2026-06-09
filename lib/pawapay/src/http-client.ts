// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – HTTP Client
// ─────────────────────────────────────────────────────────────────────────────

import type { PawaPayConfig } from "./types";
import {
  PawaPayApiError,
  PawaPayNetworkError,
  PawaPayRetryExhaustedError,
} from "./errors";
import {
  BASE_URLS,
  createTimeoutSignal,
  defaultShouldRetry,
  sleep,
} from "./utils";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | undefined>;
  signal?: AbortSignal;
}

export class HttpClient {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: PawaPayConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl =
      config.baseUrl ?? BASE_URLS[config.environment ?? "sandbox"];
    this.timeout = config.timeout ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 500;
    this.extraHeaders = config.extraHeaders ?? {};
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // ── Public request method ─────────────────────────────────────────────────

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params, signal: externalSignal } = options;

    // Build URL
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.apiToken}`,
      "User-Agent": "pawapay-ts-sdk/1.0.0",
      ...this.extraHeaders,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    // Retry loop with full-jitter exponential backoff
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Combine external signal with per-request timeout
      const timeoutSignal = createTimeoutSignal(this.timeout);
      init.signal = externalSignal
        ? this.combineSignals(externalSignal, timeoutSignal)
        : timeoutSignal;

      try {
        const response = await this.fetchImpl(url.toString(), init);
        return await this.parseResponse<T>(response);
      } catch (err) {
        lastError = err;

        const isLast = attempt === this.maxRetries;

        // Don't retry on user-triggered abort
        if (err instanceof Error && err.name === "AbortError" && externalSignal?.aborted) {
          throw new PawaPayNetworkError("Request aborted by caller.", err);
        }

        if (isLast || !defaultShouldRetry(err, attempt)) {
          break;
        }

        // Full-jitter exponential backoff
        const cap = this.retryDelay * Math.pow(2, attempt);
        const jitter = Math.random() * cap;
        await sleep(jitter);
      }
    }

    if (lastError instanceof PawaPayApiError) throw lastError;
    if (lastError instanceof PawaPayNetworkError) throw lastError;

    // Network / timeout error
    if (lastError instanceof Error) {
      if (lastError.name === "AbortError") {
        throw new PawaPayNetworkError(
          `Request timed out after ${this.timeout}ms (${this.maxRetries} retries exhausted).`,
          lastError
        );
      }
      throw new PawaPayNetworkError(lastError.message, lastError);
    }

    throw new PawaPayRetryExhaustedError(this.maxRetries + 1, lastError);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async parseResponse<T>(response: Response): Promise<T> {
    let json: unknown;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        json = await response.json();
      } catch {
        throw new PawaPayNetworkError(
          `Failed to parse JSON response (HTTP ${response.status}).`
        );
      }
    } else {
      // Non-JSON success (e.g. 204 No Content) – return empty object
      if (response.ok) return {} as T;
      throw new PawaPayNetworkError(
        `Unexpected content-type "${contentType}" with HTTP ${response.status}.`
      );
    }

    if (!response.ok) {
      const body = json as Record<string, unknown> | null;
      const failureReason = this.extractFailureReason(body, response.status);
      const requestId = response.headers.get("x-request-id") ?? undefined;
      throw new PawaPayApiError(response.status, failureReason, requestId);
    }

    return json as T;
  }

  private extractFailureReason(
    body: Record<string, unknown> | null,
    status: number
  ) {
    const reason =
      body &&
      typeof body === "object" &&
      "failureReason" in body &&
      typeof body.failureReason === "object"
        ? (body.failureReason as Record<string, unknown>)
        : null;

    return {
      failureCode: (reason?.failureCode as string) ?? "UNKNOWN_ERROR",
      failureMessage:
        (reason?.failureMessage as string) ??
        `HTTP ${status} response with no structured error body.`,
    };
  }

  /**
   * Returns a signal that is aborted when *either* input signal fires.
   * Uses native AbortSignal.any() when available (Node ≥ 20 / browsers).
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    if (
      typeof AbortSignal !== "undefined" &&
      typeof (AbortSignal as unknown as Record<string, unknown>).any ===
        "function"
    ) {
      return (
        AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }
      ).any(signals);
    }
    // Fallback: first abort wins
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
    return controller.signal;
  }
}
