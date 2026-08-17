import { NextResponse } from "next/server";

/**
 * Uniform response envelope for the `/api/v1/**` mobile surface.
 *
 * Every JSON route returns one of two shapes so the OpenAPI spec and the RN
 * client can parse without per-route special-casing:
 *   success → `{ "data": <payload> }`
 *   error   → `{ "error": { "code": string, "message": string } }`
 *
 * The streaming `chat` route and the multipart `review` route are the two
 * deliberate exceptions: they mirror the web routes exactly (SSE frames /
 * `{ error: string }`) so the shared AI handlers stay single-sourced.
 */

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "APP_CHECK_FAILED"
  | "PAYMENT_REQUIRED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Success envelope: `{ data }`. */
export function ok(data: unknown, init?: ResponseInit): Response {
  return NextResponse.json({ data }, init);
}

/** Error envelope: `{ error: { code, message } }`. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const unauthenticated = (message = "Authentication required.") =>
  apiError(401, "UNAUTHENTICATED", message);

export const appCheckFailed = (message = "Unauthorized client application.") =>
  apiError(401, "APP_CHECK_FAILED", message);

export const paymentRequired = (message = "Insufficient credit.") =>
  apiError(402, "PAYMENT_REQUIRED", message);

export const badRequest = (message = "Invalid request.") =>
  apiError(400, "BAD_REQUEST", message);

export const notFoundError = (message = "Not found.") =>
  apiError(404, "NOT_FOUND", message);

export const forbidden = (message = "Forbidden.") =>
  apiError(403, "FORBIDDEN", message);

export const internalError = (message = "Something went wrong.") =>
  apiError(500, "INTERNAL", message);

/**
 * Optional CORS support for browser-based clients (Expo Web / WebView). Native
 * React Native `fetch` does NOT enforce CORS, so these are intentionally NOT
 * wired into any route by default — enabling them would only weaken the current
 * same-origin posture for no benefit to the native target. Export a `OPTIONS`
 * handler and spread `CORS_HEADERS` onto responses in a route ONLY if you also
 * ship an Expo Web / WebView build. See `docs/mobile/skills/app-check.md`.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-firebase-appcheck, x-chat-id, x-first-message",
};

/** Preflight response for the optional CORS path above. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
