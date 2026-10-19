import { z } from "zod";
import { requireMobileAuth } from "@/lib/api/v1/guard";
import { ok, badRequest } from "@/lib/api/v1/response";
import { recordUserSession } from "@/lib/actions/auth";

/**
 * `POST /api/v1/auth/session` — records user location, device metadata, and session
 * telemetry immediately post-login for a React Native client.
 *
 * Auth & Security:
 * - App Check is ENFORCED (proves request originates from authentic app binary).
 * - Bearer ID-token is REQUIRED and verified via `requireMobileAuth`.
 * - Identity (`userId`) is extracted exclusively from the cryptographically verified token.
 * - Server rate limits to 10 session submissions per user per 10-minute window.
 *
 * Location & Privacy:
 * - Accepts optional GPS coordinates from `expo-location`.
 * - Server automatically rounds coordinates to 3 decimal places (~110m resolution)
 *   for GDPR and privacy regulation compliance.
 * - Edge IP geolocation (Vercel headers) is logged alongside GPS coordinates to detect
 *   anomalous logins or location spoofing.
 */
const sessionSchema = z.object({
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().nullable().optional(),
    })
    .optional(),
  device: z
    .object({
      platform: z.string().max(50).optional(),
      brand: z.string().max(50).optional(),
      modelName: z.string().max(100).optional(),
      osName: z.string().max(50).optional(),
      osVersion: z.string().max(50).optional(),
    })
    .optional(),
  timezone: z.string().max(100).optional(),
  resolution: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  const gate = await requireMobileAuth(req);
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid request body");
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip") ||
    "Unknown";

  const country = req.headers.get("x-vercel-ip-country") || "Unknown";
  const city = req.headers.get("x-vercel-ip-city") || "Unknown";

  const { coordinates, device, timezone, resolution } = parsed.data;

  const result = await recordUserSession({
    userId: gate.userId,
    ip,
    country,
    city,
    coordinates,
    device: device?.platform || "Mobile",
    deviceName: device?.modelName || device?.brand || "Mobile Device",
    os: device?.osName
      ? `${device.osName} ${device.osVersion ?? ""}`.trim()
      : device?.platform || "Mobile",
    browser: "React Native App",
    userAgent: req.headers.get("user-agent") || "LegalAdviserMobile",
    timezone: timezone || "Unknown",
    resolution: resolution || "Unknown",
  });

  return ok({ success: result.success });
}
