"use client";
import React, { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import { resetPasswordWithOtp, signIn } from "@/lib/actions/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { toast } from "sonner";
import { CustomButton } from "@/components/ui/custom-button";
import { CustomLink } from "@/components/global/transitions";

export const ResetPasswordForm = () => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Missing email verification. Please start over.", {
        style: {
          background: "#dc2626",
        },
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.", {
        style: {
          background: "#dc2626",
        },
      });
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.", {
        style: {
          background: "#dc2626",
        },
      });
      return;
    }

    setLoading(true);

    try {
      const result = await resetPasswordWithOtp(email, password);
      if (result.success) {
        toast.success("Password reset successful! Logging you in...", {
          style: {
            background: "#10b981",
            color: "#fff",
          },
        });

        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
          );
          const idToken = await userCredential.user.getIdToken();
          const sessionResult = await signIn({ idToken });

          if (sessionResult.success) {
            router.push("/dashboard");
          } else {
            throw new Error(sessionResult.message);
          }
        } catch (loginErr) {
          console.error("Auto login error:", loginErr);
          toast.info("Password updated. Please log in manually.", {
            style: {
              background: "#3b82f6",
              color: "#fff",
            },
          });
          setTimeout(() => {
            router.push("/login");
          }, 2000);
        }
      } else {
        toast.error(result.message, {
          style: {
            background: "#dc2626",
            color: "#fff",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Reset Password Error:", err);
      toast.error("Failed to reset password. Please try again.", {
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
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white border border-red-500 rounded p-4 mb-4">
          Verification Required
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400 mb-6">
          Please verify your email first to set a new password.
        </p>
        <CustomLink
          href="/forgot-password"
          className="inline-flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          Go to Forgot Password
        </CustomLink>
      </div>
    );
  }

  return (
    <div className="w-full transition-all duration-300">
      <form className="space-y-6" onSubmit={handleSubmit}>
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
              className="appearance-none block w-full pl-10 px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
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
              className="appearance-none block w-full pl-10 px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
              placeholder="••••••••"
            />
          </div>
        </div>

        <CustomButton
          type="submit"
          disabled={loading}
          isLoading={loading}
          variant="transparent"
          shape="pill"
          borderLeftWidth="4px"
          borderLeftColor="#4f46e5"
          borderRightWidth="4px"
          borderRightColor="#ea580c"
          className="bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest"
          rightIcon={<ArrowRight className="w-4 h-4" />}
          hoverEffect="glow"
          fullWidth
        >
          Reset Password
        </CustomButton>
      </form>
    </div>
  );
};
