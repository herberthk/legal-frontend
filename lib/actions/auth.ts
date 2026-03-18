"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import { sendOtp } from "./email";
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
 * Returns the ISO string for the next midnight (UTC)
 */
function getNextMidnight(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
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
export async function signUp(params: SignUpParams & { uid: string }) {
  const { uid, name, email } = params;
  try {
    // Check for existing user document in Firestore
    const userDocRef = db.collection(COLLECTIONS.USERS).doc(uid);
    const userSnapshot = await userDocRef.get();

    if (userSnapshot.exists) {
      return {
        success: false,
        message: "Profile already exists.",
      };
    }

    // Initialize user profile with default rewards and metadata
    const newUser: Partial<User> = {
      name,
      email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fff`,
      role: "USER",
      balance: 0,
      totalSpent: 0,
      status: "active",
      voicePreference: "Brake",
      welcomeTextTokens: FREE_WELCOME_TEXT_TOKENS,
      freeTextTokens: 0,
      freeVoiceSeconds: FREE_WELCOME_VOICE_SECONDS,
      nextDailyReset: getNextMidnight(),
      createdAt: new Date().toISOString(),
    };

    await userDocRef.set(newUser);
    return {
      success: true,
      message: "Account profile created successfully.",
    };
  } catch (error: unknown) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    // @ts-ignore
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create user profile. Please contact support.",
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
      .collection("users")
      .doc(decodedClaims.uid)
      .get();

    if (!userSnapshot.exists) return null;

    const data = userSnapshot.data();
    return {
      ...data,
      id: userSnapshot.id,
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
 * Sends a password reset email to the specified email address
 * @param email - The email address to send the reset link to
 * @returns Object with success status and message
 */
export async function forgotPassword(email: string) {
  try {
    // Check if user exists first
    const user = await auth.getUserByEmail(email);

    // Send the custom OTP email
    const otpsent = await sendOtp({
      id: user.uid,
      email: user.email || email,
      name: user.displayName || user.email?.split("@")[0] || "User",
      type: "reset",
    });

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
