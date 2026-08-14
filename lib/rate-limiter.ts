import "server-only";
import { headers } from "next/headers";
import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

export interface RateLimitOptions {
  /** Identifier prefix or action name (e.g. "otp_ip", "signup_email") */
  action: string;
  /** The key to rate limit on (IP address, email, etc.) */
  key: string;
  /** Maximum number of allowed attempts within the window */
  maxAttempts: number;
  /** Time window duration in seconds (e.g. 900 for 15 minutes) */
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  message?: string;
}

/**
 * Helper to safely extract the client IP address from Next.js server request headers.
 */
export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      // Return the first client IP in the proxy chain
      return forwardedFor.split(",")[0].trim();
    }
    const realIp = headerList.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
    const cfIp = headerList.get("cf-connecting-ip");
    if (cfIp) {
      return cfIp.trim();
    }
  } catch {
    // Fallback if called outside header context
  }
  return "127.0.0.1";
}

/**
 * Checks and updates rate limit state atomically in Firestore.
 */
export async function checkRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { action, key, maxAttempts, windowSeconds } = options;

  // Hash key to create a valid, clean Firestore doc ID
  const hashKey = crypto
    .createHash("sha256")
    .update(`${action}_${key.toLowerCase().trim()}`)
    .digest("hex");

  const docRef = db.collection(COLLECTIONS.RATE_LIMITS).doc(hashKey);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const nowMs = Date.now();

      if (!doc.exists) {
        const resetAt = Timestamp.fromMillis(nowMs + windowSeconds * 1000);
        transaction.set(docRef, {
          action,
          attempts: 1,
          resetAt,
          lastAttemptAt: FieldValue.serverTimestamp(),
        });
        return {
          success: true,
          remainingAttempts: maxAttempts - 1,
        };
      }

      const data = doc.data() as {
        attempts: number;
        resetAt: Timestamp;
      };

      const resetAtMs = data.resetAt.toMillis();

      // Window expired — reset counter
      if (nowMs >= resetAtMs) {
        const newResetAt = Timestamp.fromMillis(nowMs + windowSeconds * 1000);
        transaction.set(docRef, {
          action,
          attempts: 1,
          resetAt: newResetAt,
          lastAttemptAt: FieldValue.serverTimestamp(),
        });
        return {
          success: true,
          remainingAttempts: maxAttempts - 1,
        };
      }

      // Rate limit exceeded
      if (data.attempts >= maxAttempts) {
        const retryAfterSeconds = Math.ceil((resetAtMs - nowMs) / 1000);
        const retryMinutes = Math.ceil(retryAfterSeconds / 60);
        return {
          success: false,
          remainingAttempts: 0,
          retryAfterSeconds,
          message: `Too many requests. Please try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
        };
      }

      // Increment attempt counter within current window
      transaction.update(docRef, {
        attempts: data.attempts + 1,
        lastAttemptAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        remainingAttempts: maxAttempts - (data.attempts + 1),
      };
    });

    return result;
  } catch (error) {
    console.error("[RateLimiter] Error evaluating rate limit:", error);
    // On unexpected database error, fail open to avoid locking out legitimate users, but log it
    return {
      success: true,
      remainingAttempts: 1,
    };
  }
}
