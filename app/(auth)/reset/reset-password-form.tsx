"use client";
import React, { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPasswordWithOtp, signIn } from "@/lib/actions/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";

export const ResetPasswordForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Missing email verification. Please start over.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await resetPasswordWithOtp(email, password);
      if (result.success) {
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
          );
          const idToken = await userCredential.user.getIdToken();
          await signIn({ idToken });
          router.push("/dashboard/user");
        } catch (loginErr) {
          console.error("Auto login error:", loginErr);
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } else {
        setError(result.message);
      }
    } catch (err: unknown) {
      console.error("Reset Password Error:", err);
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white border border-red-500 rounded p-4 mb-4">
          Verification Required
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400 mb-6">
          Please verify your email first to set a new password.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          Go to Forgot Password
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-950 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700 transition-all duration-300">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            New Password
          </label>
          <div className="mt-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirm New Password
          </label>
          <div className="mt-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            </div>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 hover:shadow-lg bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 focus:ring-orange-500"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="flex items-center group">
              Reset Password
              <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
};
