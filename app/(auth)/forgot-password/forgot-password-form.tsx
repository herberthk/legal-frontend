"use client";
import React, { useState } from "react";
import { Mail, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { forgotPassword } from "@/lib/actions/auth";
import { toast } from "sonner";
import { CustomButton } from "@/components/ui/custom-button";

export const ForgotPasswordForm = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        toast.success("Password reset code has been sent to your email.", {
          style: {
            background: "#10b981",
            color: "#fff",
          },
        });
        setTimeout(() => {
          router.push(`/verify-otp?email=${btoa(email)}&type=reset`);
        }, 1500);
      } else {
        // @ts-ignore
        if (result.code === "user-not-found") {
          toast.error("Email not found. Redirecting to signup page...", {
            style: {
              background: "#dc2626",
            },
          });
          setTimeout(() => {
            router.push("/signup");
          }, 3000);
        } else {
          toast.error(result.message, {
            style: {
              background: "#dc2626",
            },
          });
        }
      }
    } catch (err: unknown) {
      console.error("Forgot Password Error:", err);
      toast.error("An unexpected error occurred. Please try again.", {
        style: {
          background: "#dc2626",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full transition-all duration-300">
      <form className="space-y-6" onSubmit={handleEmailSubmit}>
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
          rightIcon={<Send className="ml-2 w-4 h-4" />}
          hoverEffect="glow"
          fullWidth
        >
          Send Code
        </CustomButton>
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
