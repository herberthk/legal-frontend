"use client";
import React, { useState } from "react";
import { Scale, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import GoogleAuthButton from "@/components/auth/google-auth-button";
import { signIn, getCurrentUser, recordUserStats } from "@/lib/actions/auth";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { toast } from "sonner";
import { useAuthStore } from "@/store";
import { getDeviceStats } from "@/utils/device";

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("012Mv@123");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate with Firebase Client SDK
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idToken = await userCredential.user.getIdToken();

      // 2. Establish Server Session via Server Action
      const result = await signIn({ idToken });

      if (result?.success) {
        // 3. Fetch user profile to determine role-based redirection
        const user = await getCurrentUser();
        if (user) {
          // 4. Capture and Record User Statistics
          const stats = getDeviceStats();
          if (stats) {
            // We don't await this to keep login fast (best performance)
            recordUserStats(user.id, { ...stats });
          }

          setUser(user);
          const defaultPath =
            user.role === "ADMIN" ? "/dashboard/admin" : "/dashboard/user";
          router.push(returnTo || defaultPath);
        } else {
          toast.error("User profile not found. Please contact support.", {
            style: {
              background: "#dc2626",
            },
          });
        }
      } else {
        toast.error(result?.message || "Failed to sign in. Please try again.", {
          style: {
            background: "#dc2626",
          },
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Login Error:", err);
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        toast.error("Invalid email or password.", {
          style: {
            background: "#dc2626",
          },
        });
      } else {
        toast.error("An unexpected error occurred. Please try again.", {
          style: {
            background: "#dc2626",
          },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Link
          href="/"
          className="flex justify-center cursor-pointer group lg:hidden"
        >
          <div className="bg-linear-to-br from-amber-500 to-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-500/20 transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
            <Scale className="w-10 h-10 text-white" />
          </div>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Sign in to Portal
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="w-full transition-all duration-300">
          <GoogleAuthButton mode="login" returnTo={returnTo} />

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 text-xs font-medium uppercase tracking-wider">
                Or continue with email
              </span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="mt-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-12 px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-orange-500 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-orange-600 dark:text-orange-500 hover:text-orange-500 transition-colors hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-4 px-4 rounded-2xl shadow-lg text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-95 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="flex items-center group">
                  Sign In
                  <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-slate-500 text-sm">
                  New to platform?
                </span>
              </div>
            </div>
            <div className="mt-2 flex justify-center">
              <Link
                href="/signup"
                className="font-medium text-orange-600 dark:text-orange-500 hover:text-orange-500 transition-colors hover:underline"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
