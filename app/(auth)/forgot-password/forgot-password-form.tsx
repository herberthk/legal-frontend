"use client";
import React, { useState } from "react";
import { Mail, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { forgotPassword } from "@/lib/actions/auth";

export const ForgotPasswordForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        setSuccess("Password reset code has been sent to your email.");
        setTimeout(() => {
          router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        }, 1500);
      } else {
        // @ts-ignore
        if (result.code === "user-not-found") {
          setError("Email not found. Redirecting to signup page...");
          setTimeout(() => {
            router.push("/signup");
          }, 3000);
        } else {
          setError(result.message);
        }
      }
    } catch (err: unknown) {
      console.error("Forgot Password Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full transition-all duration-300">
      <form className="space-y-6" onSubmit={handleEmailSubmit}>
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-600 dark:text-green-400 text-sm font-medium">
            {success}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email address
          </label>
          <div className="mt-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full pl-10 px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
              placeholder="name@company.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !!(success && success.includes("Redirecting"))}
          className="w-full flex justify-center py-4 px-4 rounded-2xl shadow-lg text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-95 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="flex items-center group">
              Send Code
              <Send className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>

      <div className="mt-8">
        <Link
          href="/login"
          className="flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors group"
        >
          <ArrowLeft className="mr-2 w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>
      </div>
    </div>
  );
};
