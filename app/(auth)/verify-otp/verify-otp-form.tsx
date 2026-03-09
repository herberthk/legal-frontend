"use client";
import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtp } from "@/lib/actions/email";
import { forgotPassword } from "@/lib/actions/auth";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

export const VerifyOtpForm = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isOTPinValid, setIsOTPinValid] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const countdownRef = useRef(0);
  const [, setTick] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  useEffect(() => {
    // Check local storage on mount
    const storedEndTime = localStorage.getItem("otpResendTimer_legal_adviser");
    if (storedEndTime) {
      const remaining = Math.floor(
        (parseInt(storedEndTime, 10) - Date.now()) / 1000,
      );
      if (remaining > 0) {
        countdownRef.current = remaining;
        setTick((t) => t + 1);
      } else {
        localStorage.removeItem("otpResendTimer_legal_adviser");
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (countdownRef.current > 0) {
        countdownRef.current -= 1;
        setTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async () => {
    if (!email) {
      setError("Email is missing. Please restart the process.");
      return;
    }

    setResendLoading(true);
    setError(null);
    setSuccess(null);
    setOtp("");
    setIsOTPinValid(false);

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setSuccess("A new verification code has been sent!");
        countdownRef.current = 60;
        setTick((t) => t + 1);
        localStorage.setItem(
          "otpResendTimer_legal_adviser",
          (Date.now() + 60 * 1000).toString(),
        );
      } else {
        setError(result.message || "Failed to resend code.");
      }
    } catch (err: unknown) {
      console.error("Resend OTP Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email is missing. Please restart the process.");
      return;
    }

    if (otp.length !== 6) {
      setIsOTPinValid(true);
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await verifyOtp(email, otp);
      if (result.success) {
        setSuccess("Verification successful! Redirecting...");
        setTimeout(() => {
          router.push(`/reset?email=${encodeURIComponent(email)}`);
        }, 1500);
      } else {
        setError(result.message);
        setIsOTPinValid(true);
        setTimeout(() => {
          setOtp("");
        }, 4000);
      }
    } catch (err: unknown) {
      console.error("Verify OTP Error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-950 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700 transition-all duration-300 text-center">
        <p className="text-red-500 mb-6">Missing email address to verify.</p>
        <Link
          href="/forgot-password"
          className="inline-flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          Go Back
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-950 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700 transition-all duration-300">
      <form className="space-y-6" onSubmit={handleOtpSubmit}>
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

        <div className="flex flex-col items-center justify-center space-y-4 pt-4">
          <InputOTP
            maxLength={6}
            value={otp}
            required
            onChange={(e) => {
              if (isOTPinValid) {
                setIsOTPinValid(false);
              }
              setOtp(e);
            }}
            disabled={loading}
            pattern={REGEXP_ONLY_DIGITS}
          >
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
              <InputOTPSlot index={0} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={1} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={2} aria-invalid={isOTPinValid} />
            </InputOTPGroup>
            <InputOTPSeparator className="mx-2" />
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
              <InputOTPSlot index={3} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={4} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={5} aria-invalid={isOTPinValid} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            otp.length !== 6 ||
            !!(success && success.includes("Redirecting"))
          }
          className="w-full mt-8 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 hover:shadow-lg bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 focus:ring-orange-500"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="flex items-center group">
              Verify Code
              <KeyRound className="ml-2 w-4 h-4 transform group-hover:-translate-y-0.5 transition-transform" />
            </span>
          )}
        </button>

        <div className="flex items-center justify-between mt-4 text-sm px-1">
          <Link
            href="/forgot-password"
            className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors inline-flex items-center"
          >
            <ArrowLeft className="mr-1 w-3 h-3" />
            Change Email
          </Link>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || countdownRef.current > 0 || loading}
            className="font-medium text-orange-600 dark:text-orange-500 hover:underline disabled:opacity-50 disabled:no-underline transition-colors"
          >
            {resendLoading
              ? "Sending..."
              : countdownRef.current > 0
                ? `Resend in ${countdownRef.current}s`
                : "Resend code?"}
          </button>
        </div>
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
