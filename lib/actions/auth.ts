"use server";

import { auth, db } from "@/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { sendOtp } from "./email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  COLLECTIONS,
  FREE_WELCOME_TEXT_TOKENS,
  FREE_WELCOME_VOICE_SECONDS,
} from "@/constants";

/**
 * Session duration constant set to 1 week in seconds
 * Used for setting cookie expiration and session duration
 */
const SESSION_DURATION = 60 * 60 * 24 * 7;

/**
 * Returns the Timestamp for the next 3 days
 */
function getNextResetTime(): Timestamp {
  const nextReset = Timestamp.fromMillis(Date.now() + 5 * 24 * 60 * 60 * 1000);
  return nextReset;
}

/**
 * Creates and sets a session cookie in the browser using Firebase ID token
 * @param idToken - Firebase ID token from authenticated user
 */
export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  // Create session cookie with Firebase
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION * 1000, // Convert to milliseconds
  });

  // Set secure HTTP-only cookie in browser
  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

/**
 * Creates a new user account in Firestore
 * @param params - Object containing uid, name, and email of new user
 * @returns Object with success status and message
 */
export async function signUp(
  params: SignUpParams & { uid: string; avatar?: string },
) {
  const { uid, name, email, avatar } = params;
  try {
    // Check for existing user document in Firestore
    const userDocRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const userSnapshot = await userDocRef.get();

    if (userSnapshot.exists) {
      return {
        success: true, // If user exists, we consider this a successful "sync"
        message: "Profile already exists.",
      };
    }

    // Initialize user profile with default rewards and metadata
    const newUser: FirestoreWrite<
      Omit<User, "id">,
      "createdAt" | "nextDailyReset"
    > = {
      name: name || email.split("@")[0] || "User",
      email: email.toLowerCase(),
      avatar:
        avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email.split("@")[0] || "User")}&background=0f172a&color=fff`,
      role: "USER",
      balance: 0,
      totalSpent: 0,
      status: "active",
      preferedVoice: {
        preferedVoiceId: "Aoede",
        preferedVoiceName: "Evelyn",
      },
      welcomeTextTokens: FREE_WELCOME_TEXT_TOKENS,
      freeTextTokens: 0,
      freeVoiceSeconds: FREE_WELCOME_VOICE_SECONDS,
      nextDailyReset: getNextResetTime(),
      createdAt: FieldValue.serverTimestamp(),
    };

    await userDocRef.set(newUser);
    return {
      success: true,
      message: "Account profile created successfully.",
    };
  } catch (error: unknown) {
    console.error("Error creating user:", error);

    return {
      success: false,
      message: "Failed to create user profile. Please contact support.",
    };
  }
}

/**
 * Initiates the signup process by sending an OTP and storing details temporarily.
 */
export async function initiateSignup(params: SignUpParams) {
  const { name, email, password } = params;
  try {
    // 0. IP & Email Rate Limiting (Prevent OTP flooding)
    const clientIp = await getClientIp();
    const ipLimit = await checkRateLimit({
      action: "signup_ip",
      key: clientIp,
      maxAttempts: 5,
      windowSeconds: 15 * 60,
    });

    if (!ipLimit.success) {
      return {
        success: false,
        message: ipLimit.message || "Too many signup attempts from this IP. Please try again later.",
      };
    }

    const emailLimit = await checkRateLimit({
      action: "signup_email",
      key: email,
      maxAttempts: 3,
      windowSeconds: 15 * 60,
    });

    if (!emailLimit.success) {
      return {
        success: false,
        message: emailLimit.message || "Too many verification requests for this email. Please try again later.",
      };
    }

    // 1. Check if user already exists in Firebase Auth
    try {
      await auth.getUserByEmail(email);
      return {
        success: false,
        message: "An account with this email already exists. Please log in.",
      };
    } catch (authError: unknown) {
      if ((authError as { code: string }).code !== "auth/user-not-found") {
        throw authError;
      }
    }

    // 2. Store in pending_signups
    const pendingRef = db.collection(COLLECTIONS.PENDING_SIGNUPS).doc(email);
    await pendingRef.set({
      name,
      email,
      password, // Plain password stored temporarily (Secure server-side access only)
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. Send OTP
    const otpsent = await sendOtp({
      id: email,
      email,
      name,
      type: "verify",
    });

    if (!otpsent) {
      return {
        success: false,
        message: "Failed to send verification code. Please try again.",
      };
    }

    return {
      success: true,
      message: "Verification code sent to your email.",
    };
  } catch (error) {
    console.error("InitiateSignup Error:", error);
    return {
      success: false,
      message: "An error occurred. Please try again later.",
    };
  }
}

/**
 * Completes the signup process after OTP verification.
 */
export async function completeSignup(email: string, otp: string) {
  const { verifyOtp } = await import("./email");
  try {
    // 1. Verify OTP
    const verification = await verifyOtp(email, otp);
    if (!verification.success) {
      return {
        success: verification.success,
        message: verification.message,
        uid: "",
        customToken: "",
      };
    }

    // 2. Get pending data
    const pendingRef = db.collection(COLLECTIONS.PENDING_SIGNUPS).doc(email);
    const pendingSnap = await pendingRef.get();

    if (!pendingSnap.exists) {
      return {
        success: false,
        message: "Signup session expired. Please start over.",
        uid: "",
        customToken: "",
      };
    }

    const { name, password } = pendingSnap.data()!;

    // 3. Create user in Firebase Auth
    const user = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true, // We verified it via OTP
    });

    // 4. Create profile in Firestore
    const profileResult = await signUp({
      uid: user.uid,
      name,
      email,
    });

    // 5. Delete pending data
    await pendingRef.delete();

    if (!profileResult.success) {
      return {
        success: profileResult.success,
        message: profileResult.message,
        uid: "",
        customToken: "",
      };
    }

    // 6. Delete OTP document to prevent reuse
    await db.collection(COLLECTIONS.OTP).doc(email).delete();

    // 7. Generate Custom Token for seamless client-side login
    const customToken = await auth.createCustomToken(user.uid);

    return {
      success: true,
      message: "Account created successfully.",
      uid: user.uid,
      customToken,
    };
  } catch (error) {
    console.error("CompleteSignup Error:", error);
    return {
      success: false,
      message: "Verification failed. Please try again.",
      uid: "",
      customToken: "",
    };
  }
}

/**
 * Authenticates user and creates session cookie
 * @param params - Object containing email and Firebase ID token
 * @returns Object with success status and message if error occurs
 */
export async function signIn(params: { idToken: string }) {
  const { idToken } = params;

  try {
    // Verify the idToken first to ensure it's valid before setting a session cookie
    await auth.verifyIdToken(idToken);
    await setSessionCookie(idToken);

    return { success: true };
  } catch (error) {
    console.error("SignIn Error:", error);
    return {
      success: false,
      message: "Authentication failed. Please sign in again.",
    };
  }
}

/**
 * Ends user session by removing session cookie
 */
export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

/**
 * Retrieves current user data from session cookie
 * @returns User object if session is valid, null otherwise
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Fetch user data from Firestore
    const userSnapshot = await db
      .collection(COLLECTIONS.USERS)
      .doc(decodedClaims.uid)
      .get();

    if (!userSnapshot.exists) return null;

    const data = userSnapshot.data();
    return {
      ...data,
      id: userSnapshot.id,
      createdAt:
        data?.createdAt?.toDate().toISOString() || new Date().toISOString(),
      nextDailyReset:
        data?.nextDailyReset?.toDate().toISOString() ||
        new Date().toISOString(),
      updatedAt:
        data?.updatedAt?.toDate().toISOString() || new Date().toISOString(),
    } as User;
  } catch (error) {
    console.error("GetCurrentUser Error:", error);
    return null;
  }
}

/**
 * Extracts the authenticated user ID from the session cookie.
 */
export const getAuthenticatedUserId = async (): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
};

/**
 * Checks if user has valid authentication session
 * @returns boolean indicating authentication status
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Helper to deliver a password reset OTP email.
 */
async function deliverResetOtp(user: {
  uid: string;
  email?: string;
  displayName?: string;
}) {
  return await sendOtp({
    id: user.uid,
    email: user.email || "",
    name: user.displayName || user.email?.split("@")[0] || "User",
    type: "reset",
  });
}

/**
 * Sends a password reset email to the specified email address
 * @param email - The email address to send the reset link to
 * @returns Object with success status and message
 */
export async function forgotPassword(email: string) {
  try {
    // 0. IP & Email Rate Limiting (Prevent password reset enumeration/spam)
    const clientIp = await getClientIp();
    const ipLimit = await checkRateLimit({
      action: "reset_ip",
      key: clientIp,
      maxAttempts: 5,
      windowSeconds: 15 * 60,
    });

    if (!ipLimit.success) {
      return {
        success: false,
        message: ipLimit.message || "Too many password reset attempts from this IP. Please try again later.",
      };
    }

    const emailLimit = await checkRateLimit({
      action: "reset_email",
      key: email,
      maxAttempts: 3,
      windowSeconds: 15 * 60,
    });

    if (!emailLimit.success) {
      return {
        success: false,
        message: emailLimit.message || "Too many password reset requests for this email. Please try again later.",
      };
    }

    // Check if user exists first
    const user = await auth.getUserByEmail(email);

    // Send the custom OTP email
    const otpsent = await deliverResetOtp(user);

    if (!otpsent) {
      return {
        success: false,
        message: "Failed to send OTP. Please check your email settings.",
      };
    }

    return {
      success: true,
      message: "User found, OTP sent.",
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code === "auth/user-not-found"
    ) {
      return {
        success: false,
        code: "user-not-found",
        message: "No account found with this email address.",
      };
    }

    console.error("ForgotPassword Error:", error);
    return {
      success: false,
      message: "Failed to process request. Please try again.",
    };
  }
}

export async function resetPasswordWithOtp(email: string, newPassword: string) {
  try {
    const user = await auth.getUserByEmail(email);

    const docRef = db.collection(COLLECTIONS.OTP).doc(user.uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return {
        success: false,
        message: "No OTP request found. Please start over.",
      };
    }

    const data = docSnap.data() as Otp & { verified?: boolean };

    if (!data.verified) {
      return {
        success: false,
        message: "OTP not verified. Please verify your code first.",
      };
    }

    // Update the password using Admin SDK
    await auth.updateUser(user.uid, { password: newPassword });

    // Delete OTP document to prevent reuse
    await docRef.delete();

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    console.error("resetPasswordWithOtp error", error);
    return {
      success: false,
      message: "Failed to reset password. Please try again.",
    };
  }
}

// export const createSession = async (user: User) => {
//   const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
//   //   const session = await encrypt({ userId, expires });
//   const cookieStore = await cookies();
//   await cookieStore.set("session", JSON.stringify(user), {
//     expires,
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "lax",
//     path: "/",
//   });
// };

// export const getUserSession = async () => {
//   const cookieStore = await cookies();
//   const session = cookieStore.get("session")?.value;
//   if (!session) {
//     return null;
//   }
//   return JSON.parse(session) as User;
// };

/**
 * Records user statistics in Firestore.
 */
export async function recordUserStats(
  stats: Omit<UserStats, "userId" | "ip" | "createdAt" | "country" | "city">,
) {
  // Derive the user from the verified session cookie — never trust a client-supplied uid.
  // This also gates the analytics writes behind authentication, so anonymous callers
  // can't spam this action to inflate counters or run up Firestore write costs.
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { success: false };
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
    return { success: false };
  }

  const { headers } = await import("next/headers");
  const headerList = await headers();

  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0] ||
    headerList.get("x-real-ip") ||
    "Unknown";

  const country = headerList.get("x-vercel-ip-country") || "Unknown";
  const city = headerList.get("x-vercel-ip-city") || "Unknown";

  const deviceStats = {
    browser: headerList.get("x-device-browser"),
    browserVersion: headerList.get("x-device-browser-version"),
    os: headerList.get("x-device-os"),
    osVersion: headerList.get("x-device-os-version"),
    device: headerList.get("x-device-type"),
    model: headerList.get("x-device-model"),
    vendor: headerList.get("x-device-vendor"),
    userAgent: headerList.get("x-device-ua"),
  };

  console.log("deviceStats", deviceStats);

  // Normalise values for aggregation keys (lowercase, alphanumeric only)
  const normBrowser = (stats.browser || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normOs = (stats.os || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normDevice = (stats.device || "Desktop").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normCountry = (country || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const normCity = (city || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");

  try {
    const analyticsRef = db.collection(COLLECTIONS.ANALYTICS).doc("demographics");

    // Run both writes in parallel for performance
    await Promise.all([
      // Raw session record
      db.collection(COLLECTIONS.USER_STATS).add({
        ...stats,
        userId,
        ip,
        country,
        city,
        createdAt: FieldValue.serverTimestamp(),
      }),
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
    return { success: false };
  }
}

/**
 * Resends an OTP for either a pending signup or a password reset.
 * @param email - The user's email address
 * @param type - The type of OTP flow ('signup' or 'reset')
 */
export async function resendOtpAction(email: string, type: "signup" | "reset") {
  try {
    const clientIp = await getClientIp();

    if (type === "signup") {
      const ipLimit = await checkRateLimit({
        action: "resend_otp_ip",
        key: clientIp,
        maxAttempts: 5,
        windowSeconds: 15 * 60,
      });

      if (!ipLimit.success) {
        return {
          success: false,
          message: ipLimit.message || "Too many OTP resend requests from this IP. Please try again later.",
        };
      }

      const emailLimit = await checkRateLimit({
        action: "resend_otp_email",
        key: email,
        maxAttempts: 3,
        windowSeconds: 10 * 60,
      });

      if (!emailLimit.success) {
        return {
          success: false,
          message: emailLimit.message || "Too many OTP resend requests for this email. Please try again later.",
        };
      }

      const pendingRef = db.collection(COLLECTIONS.PENDING_SIGNUPS).doc(email);
      const pendingSnap = await pendingRef.get();

      if (!pendingSnap.exists) {
        return {
          success: false,
          message: "Signup session expired. Please start over.",
        };
      }

      const { name } = pendingSnap.data()!;
      const otpsent = await sendOtp({
        id: email,
        email,
        name,
        type: "verify",
      });

      if (!otpsent) {
        return { success: false, message: "Failed to resend code." };
      }

      return { success: true, message: "New verification code sent!" };
    } else {
      // For reset OTP resend: apply reset limits directly without double-counting or invoking forgotPassword
      const ipLimit = await checkRateLimit({
        action: "reset_ip",
        key: clientIp,
        maxAttempts: 5,
        windowSeconds: 15 * 60,
      });

      if (!ipLimit.success) {
        return {
          success: false,
          message: ipLimit.message || "Too many password reset attempts from this IP. Please try again later.",
        };
      }

      const emailLimit = await checkRateLimit({
        action: "reset_email",
        key: email,
        maxAttempts: 3,
        windowSeconds: 15 * 60,
      });

      if (!emailLimit.success) {
        return {
          success: false,
          message: emailLimit.message || "Too many password reset requests for this email. Please try again later.",
        };
      }

      const user = await auth.getUserByEmail(email);
      const otpsent = await deliverResetOtp(user);

      if (!otpsent) {
        return {
          success: false,
          message: "Failed to send verification code. Please try again.",
        };
      }

      return {
        success: true,
        message: "New verification code sent!",
      };
    }
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code === "auth/user-not-found"
    ) {
      return {
        success: false,
        code: "user-not-found",
        message: getFriendlyErrorMessage("auth/user-not-found"),
      };
    }

    console.error("ResendOtpAction Error:", error);
    return {
      success: false,
      message: "An error occurred while resending the code. Please try again.",
    };
  }
}
