"use client";
import React, { useState } from "react";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import GoogleAuthButton from "@/components/auth/google-auth-button";
import { signIn, getCurrentUser, recordUserStats } from "@/lib/actions/auth";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { toast } from "sonner";
import { useAuthStore } from "@/store";
import { getDeviceStats } from "@/utils/device";
import { CustomButton } from "@/components/ui/custom-button";
import { LogoText } from "@/components/global/Logo";
import { CustomLink } from "@/components/global/transitions";
import DirectionalTransition from "@/components/global/DirectionalTransition";
// 012Mv@123
const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      toast.error("Please agree to the Terms of Service and Privacy Policy to continue.", {
        style: { background: "#dc2626", color: "#fff" },
      });
      return;
    }

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
            // Fire-and-forget to keep login fast; handle the promise so a failed
            // background analytics write can't become an unhandled rejection.
            // Non-fatal — log only, never interrupt the auth flow.
            recordUserStats({ ...stats }).catch((err) =>
              console.error("recordUserStats failed:", err),
            );
          }

          setUser(user);
          const defaultPath =
            user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
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
    <DirectionalTransition>
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CustomLink
          href="/"
          className="flex justify-center cursor-pointer group lg:hidden"
          aria-label="Go to home page"
        >
          <LogoText />
        </CustomLink>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Sign in to Portal
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="w-full transition-all duration-300">
          <GoogleAuthButton mode="login" returnTo={returnTo} agreedToTerms={agreedToTerms} />

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
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="mt-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" aria-hidden="true" />
                </div>
                <input
                  id="email"
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
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="mt-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" aria-hidden="true" />
                </div>
                <input
                  id="password"
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
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-orange-500 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <CustomLink
                  href="/forgot-password"
                  className="text-xs font-medium text-orange-600 dark:text-orange-500 hover:text-orange-500 transition-colors hover:underline"
                >
                  Forgot Password?
                </CustomLink>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-800 dark:focus:ring-orange-600 transition-colors cursor-pointer"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="font-medium text-slate-600 dark:text-slate-300">
                  By signing in, you agree to our{" "}
                  <CustomLink href="/terms" className="text-orange-600 hover:text-orange-500 hover:underline">Terms</CustomLink>
                  {" "}and{" "}
                  <CustomLink href="/privacy" className="text-orange-600 hover:text-orange-500 hover:underline">Privacy Policy</CustomLink>.
                </label>
              </div>
            </div>
            <CustomButton
              type="submit"
              disabled={loading}
              isLoading={loading}
              aria-busy={loading}
              variant="transparent"
              shape="pill"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className={`bg-slate-100/50 dark:bg-slate-800/50 uppercase tracking-widest ${
                !agreedToTerms ? "opacity-50 cursor-not-allowed" : ""
              }`}
              rightIcon={<ArrowRight aria-hidden="true" />}
              hoverEffect="glow"
              fullWidth
            >
              Sign In
            </CustomButton>
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
              <CustomLink
                href="/signup"
                className="font-medium text-orange-600 dark:text-orange-500 hover:text-orange-500 transition-colors hover:underline"
              >
                Start Free Trial
              </CustomLink>
            </div>
          </div>
        </div>
      </div>
    </DirectionalTransition>
  );
};

export default LoginPage;
