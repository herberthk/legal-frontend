import "server-only";

import { db } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/constants";
import { checkRateLimit } from "@/lib/rate-limiter";

export interface RecordSessionParams {
  userId: string;
  ip?: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
  deviceName?: string;
  resolution?: string;
  timezone?: string;
  userAgent?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
}

type RecordSessionResult =
  | { success: true }
  | {
      success: false;
      code: "UNAUTHENTICATED" | "RATE_LIMITED" | "INTERNAL";
      message: string;
    };

/**
 * Core session and demographic recording logic.
 * Internal only: callers must authenticate and supply the verified user ID.
 * Used by web `recordUserStats` and mobile `POST /api/v1/auth/session`.
 */
export async function recordUserSession(
  params: RecordSessionParams,
): Promise<RecordSessionResult> {
  const {
    userId,
    ip = "Unknown",
    country = "Unknown",
    city = "Unknown",
    coordinates,
    ...stats
  } = params;

  if (!userId) {
    return { success: false, code: "UNAUTHENTICATED", message: "Unauthenticated" };
  }

  // Bound abuse from an authenticated caller: normal usage records once per login,
  // so a small per-user allowance lets legitimate re-logins through while stopping
  // loops that would pollute analytics counters or run up Firestore write costs.
  const statsLimit = await checkRateLimit({
    action: "record_user_stats",
    key: userId,
    maxAttempts: 10,
    windowSeconds: 10 * 60,
  });
  if (!statsLimit.success) {
    return { success: false, code: "RATE_LIMITED", message: "Rate limit exceeded" };
  }

  // Normalise values for aggregation keys (lowercase, alphanumeric only)
  const normBrowser = (stats.browser || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normOs = (stats.os || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normDevice = (stats.device || "Desktop").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normCountry = (country || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normCity = (city || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");

  try {
    const analyticsRef = db.collection(COLLECTIONS.ANALYTICS).doc("demographics");

    const sessionPayload: Record<string, unknown> = {
      ...stats,
      userId,
      ip,
      country,
      city,
      createdAt: FieldValue.serverTimestamp(),
    };

    if (
      coordinates &&
      typeof coordinates.latitude === "number" &&
      typeof coordinates.longitude === "number" &&
      Number.isFinite(coordinates.latitude) &&
      Number.isFinite(coordinates.longitude) &&
      coordinates.latitude >= -90 &&
      coordinates.latitude <= 90 &&
      coordinates.longitude >= -180 &&
      coordinates.longitude <= 180
    ) {
      sessionPayload.coordinates = {
        // Round to 3 decimal places (~110m) to reduce location precision.
        latitude: Math.round(coordinates.latitude * 1000) / 1000,
        longitude: Math.round(coordinates.longitude * 1000) / 1000,
        accuracy: coordinates.accuracy ?? null,
      };
    }

    // Run both writes in parallel for performance
    await Promise.all([
      // Raw session record
      db.collection(COLLECTIONS.USER_STATS).add(sessionPayload),
      // Aggregate counters — merge:true ensures the doc is created if missing
      analyticsRef.set(
        {
          totalSessions: FieldValue.increment(1),
          browsers: { [normBrowser]: FieldValue.increment(1) },
          operatingSystems: { [normOs]: FieldValue.increment(1) },
          devices: { [normDevice]: FieldValue.increment(1) },
          countries: { [normCountry]: FieldValue.increment(1) },
          cities: { [normCity]: FieldValue.increment(1) },
          // Keep human-readable labels alongside the keys
          browserLabels: { [normBrowser]: stats.browser || "Unknown" },
          osLabels: { [normOs]: stats.os || "Unknown" },
          deviceLabels: { [normDevice]: stats.device || "Desktop" },
          countryLabels: { [normCountry]: country },
          cityLabels: { [normCity]: city },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ]);

    return { success: true };
  } catch (error) {
    console.error("Error recording user stats:", error);
    return { success: false, code: "INTERNAL", message: "Failed to record session." };
  }
}

