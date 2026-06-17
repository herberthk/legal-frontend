"use client";

import React, { useState } from "react";
import { auth } from "@/firebase/client";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { signIn, signUp, recordUserStats, getCurrentUser } from "@/lib/actions/auth";
import { useRouter } from "nextjs-toploader/app";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { getDeviceStats } from "@/utils/device";

interface GoogleAuthButtonProps {
  mode: "login" | "signup";
  returnTo?: string | null;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  mode,
  returnTo,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      // 1. Firebase Popup Sign-In
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // 2. Ensure User Profile exists in Firestore
      // We pass name and avatar from the Google account
      const profileResult = await signUp({
        uid: user.uid,
        name: user.displayName || "Google User",
        email: user.email || "",
        avatar: user.photoURL || undefined,
      });

      if (!profileResult.success) {
        throw new Error(profileResult.message);
      }

      // 3. Establish Server Session
      const sessionResult = await signIn({ idToken });

      if (sessionResult.success) {
       
        // 4. Record User Statistics
        const stats = getDeviceStats();
        if (stats) {
          recordUserStats(user.uid, { ...stats });
        }

         // 5. Fetch user profile to determine role-based redirection
                const currentUser = await getCurrentUser();
        // 6. Update Local State & Redirect
        // For Google Auth, we might need a small delay to ensure Firestore is synced if it was a new user
        // But the signUp action handles creation synchronously.

        // Fetch current user details to update store (or we could derive from Google user)
        // For simplicity and correctness, we'll let the next page load handle it or assume success

        toast.success(
          mode === "login" ? "Welcome back!" : "Account created successfully!",
          {
            style: { background: "#10b981", color: "#fff" },
          },
        );

            const defaultPath =
            currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";

        const redirectPath = returnTo || defaultPath;
        router.push(redirectPath);
      } else {
        throw new Error(sessionResult.message);
      }
    } catch (error: unknown) {
      console.error("Google Auth Error:", error);

      let errorMessage = "Failed to sign in with Google.";

      if (error && typeof error === "object" && "code" in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === "auth/popup-closed-by-user") {
          errorMessage = "Sign-in cancelled.";
        } else if (firebaseError.code === "auth/popup-blocked") {
          errorMessage = "Sign-in popup was blocked by your browser. Please allow popups for this site.";
        } else if (
          firebaseError.code === "auth/account-exists-with-different-credential"
        ) {
          errorMessage =
            "An account already exists with the same email address but different sign-in credentials.";
        }
      }

      toast.error(errorMessage, {
        style: { background: "#dc2626", color: "#fff" },
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="relative w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Authenticating...
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="normal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {mode === "login" ? "Sign in with Google" : "Sign up with Google"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle shine effect on hover */}
      <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine transition-transform duration-1000" />
    </motion.button>
  );
};

export default GoogleAuthButton;
