"use client";
import React, { useState, useEffect } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import { verifyOtp } from "@/lib/actions/email";
import {
  completeSignup,
  resendOtpAction,
  signIn as setSession,
} from "@/lib/actions/auth";
import { auth } from "@/firebase/client";
import { signInWithCustomToken } from "firebase/auth";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import { CustomButton } from "@/components/ui/custom-button";

export const VerifyOtpForm = () => {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOTPinValid, setIsOTPinValid] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const otpTimer = useAuthStore((state) => state.otpResetTimer);
  const updateResetTimer = useAuthStore((state) => state.updateOtpTimer);
  const [remaining, setRemaining] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const rawEmail = searchParams.get("email") || "";

  // Safe Base64 decoding
  const getDecodedEmail = (str: string) => {
    try {
      return atob(str);
    } catch {
      return str;
    }
  };

  const email = getDecodedEmail(rawEmail);
  const type = (searchParams.get("type") as "signup" | "reset") || "reset";
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    // Rehydrate Zustand state explicitly as our store runs skipHydration
    useAuthStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (otpTimer > Date.now()) {
      setRemaining(Math.floor((otpTimer - Date.now()) / 1000));
      const interval = setInterval(() => {
        const timeLeft = Math.floor((otpTimer - Date.now()) / 1000);
        if (timeLeft <= 0) {
          setRemaining(0);
          updateResetTimer(0);
          clearInterval(interval);
        } else {
          setRemaining(timeLeft);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setRemaining(0);
      if (otpTimer !== 0) {
        updateResetTimer(0);
      }
    }
  }, [otpTimer, updateResetTimer]);

  const handleResend = async () => {
    if (!email) {
      toast.error("Email is missing. Please restart the process.", {
        style: {
          background: "#dc2626",
          color: "#fff",
        },
      });
      return;
    }

    setResendLoading(true);
    setOtp("");
    setIsOTPinValid(false);

    try {
      const result = await resendOtpAction(email, type);
      if (result.success) {
        toast.success(
          result.message || "A new verification code has been sent!",
          {
            style: {
              background: "#10b981",
              color: "#fff",
            },
          },
        );
        // Store the exact future expiration timestamp in Zustand
        updateResetTimer(Date.now() + 60 * 1000);
      } else {
        toast.error(result.message || "Failed to resend code.", {
          style: {
            background: "#dc2626",
            color: "#fff",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Resend OTP Error:", err);
      toast.error("An unexpected error occurred. Please try again.", {
        style: {
          background: "#dc2626",
          color: "#fff",
        },
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Email is missing. Please restart the process.", {
        style: {
          background: "#dc2626",
          color: "#fff",
        },
      });
      return;
    }

    if (otp.length !== 6) {
      setIsOTPinValid(true);
      toast.error("Please enter the 6-digit verification code.", {
        style: {
          background: "#dc2626",
          color: "#fff",
        },
      });
      return;
    }

    setLoading(true);

    try {
      if (type === "signup") {
        const result = await completeSignup(email, otp);
        if (result.success && result.customToken) {
          // Sign in on client-side to get ID token
          const userCredential = await signInWithCustomToken(
            auth,
            result.customToken,
          );
          const idToken = await userCredential.user.getIdToken();

          // Establish server-side session
          const sessionResult = await setSession({ idToken });

          if (sessionResult.success) {
            toast.success("Account verified! Welcome aboard.", {
              style: {
                background: "#10b981",
                color: "#fff",
              },
            });
            setTimeout(() => {
              router.push(returnTo || "/dashboard");
            }, 1000);
          } else {
            throw new Error(
              sessionResult.message || "Session creation failed.",
            );
          }
        } else {
          toast.error(result.message || "Verification failed.", {
            style: {
              background: "#dc2626",
              color: "#fff",
            },
          });
          setIsOTPinValid(true);
        }
      } else {
        // Reset flows
        const result = await verifyOtp(email, otp);
        if (result.success) {
          toast.success("Verification successful! Redirecting...", {
            style: {
              background: "#10b981",
              color: "#fff",
            },
          });
          setTimeout(() => {
            router.push(`/reset?email=${rawEmail}`);
          }, 1500);
        } else {
          toast.error(result.message, {
            style: {
              background: "#dc2626",
              color: "#fff",
            },
          });
          setIsOTPinValid(true);
          setTimeout(() => {
            setOtp("");
          }, 4000);
        }
      }
    } catch (err: unknown) {
      console.error("Verify OTP Error:", err);
      toast.error("An unexpected error occurred. Please try again.", {
        style: {
          background: "#dc2626",
          color: "#fff",
        },
      });
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
    <div className="w-full transition-all duration-300">
      <form className="space-y-6" onSubmit={handleOtpSubmit}>
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
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-xl *:data-[slot=input-otp-slot]:border-slate-200 dark:*:data-[slot=input-otp-slot]:border-slate-700 *:data-[slot=input-otp-slot]:bg-slate-50 dark:*:data-[slot=input-otp-slot]:bg-slate-900/50 *:data-[slot=input-otp-slot]:rounded-xl focus-within:ring-indigo-500">
              <InputOTPSlot index={0} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={1} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={2} aria-invalid={isOTPinValid} />
            </InputOTPGroup>
            <InputOTPSeparator className="mx-2 text-slate-400" />
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-14 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:text-xl *:data-[slot=input-otp-slot]:border-slate-200 dark:*:data-[slot=input-otp-slot]:border-slate-700 *:data-[slot=input-otp-slot]:bg-slate-50 dark:*:data-[slot=input-otp-slot]:bg-slate-900/50 *:data-[slot=input-otp-slot]:rounded-xl focus-within:ring-indigo-500">
              <InputOTPSlot index={3} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={4} aria-invalid={isOTPinValid} />
              <InputOTPSlot index={5} aria-invalid={isOTPinValid} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* <button
          type="submit"
          disabled={loading || otp.length !== 6 || remaining > 0}
          className="w-full mt-8 flex justify-center py-4 px-4 rounded-2xl shadow-lg text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-95 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span className="flex items-center group">
              Verify Code
              <KeyRound className="ml-2 w-4 h-4 transform group-hover:-translate-y-0.5 transition-transform" />
            </span>
          )}
        </button> */}
        <CustomButton
          type="submit"
          disabled={loading || otp.length !== 6 || remaining > 0}
          isLoading={loading}
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest"
          rightIcon={<KeyRound className="w-4 h-4" />}
          hoverEffect="glow"
          fullWidth
        >
          Verify Code
        </CustomButton>

        <div className="flex items-center justify-between mt-4 text-sm px-1">
          {/* <Link
            href="/forgot-password"
            className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors inline-flex items-center"
          >
            <ArrowLeft className="mr-1 w-3 h-3" />
            Change Email
          </Link> */}
          <div></div>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || remaining > 0 || loading}
            className="font-medium text-orange-600 dark:text-orange-500 hover:underline disabled:opacity-50 disabled:no-underline transition-colors disabled:cursor-not-allowed"
          >
            {resendLoading
              ? "Sending..."
              : remaining > 0
                ? `Resend in ${remaining}s`
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
