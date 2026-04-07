"use client";
import React, { useState } from "react";
import { Scale, Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { signUp, signIn, recordUserStats } from "@/lib/actions/auth";
import { toast } from "sonner";
import { getDeviceStats } from "@/utils/device";

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("0123456789");

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !password) {
      toast.error("All fields are required", {
        style: {
          background: "#dc2626",
        },
      });
      return;
    }
    setLoading(true);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const uid = userCredential.user.uid;
      const idToken = await userCredential.user.getIdToken();

      // 2. Initialize Firestore User Profile via Server Action
      const profileResult = await signUp({ uid, name, email });

      if (profileResult.success) {
        // 3. Establish Server Session
        const sessionResult = await signIn({ idToken });

        if (sessionResult?.success) {
          // 4. Record Signup Statistics
          const stats = getDeviceStats();
          if (stats) {
            recordUserStats(uid, { ...stats });
          }
          router.push(returnTo || "/dashboard/user");
        } else {
          toast.error(
            sessionResult?.message ||
              "Profile created, but failed to start session. Please log in.",
            {
              style: {
                background: "#dc2626",
              },
            },
          );
        }
      } else {
        toast.success(profileResult.message, {
          style: {
            background: "green",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Signup Error:", err);
      const firebaseError = err as { code: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        toast.error("This email is already in use.", {
          style: {
            background: "#dc2626",
          },
        });
      } else if (firebaseError.code === "auth/weak-password") {
        toast.error("Password should be at least 6 characters.", {
          style: {
            background: "#dc2626",
          },
        });
      } else {
        toast.error("An error occurred during signup. Please try again.", {
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
          Create Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="w-full transition-all duration-300">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  placeholder="John Doe"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none block w-full px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
                />
              </div>
            </div>

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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all duration-200"
                  placeholder="••••••••"
                />
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
                  Create Account
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
                  Already have an account?
                </span>
              </div>
            </div>
            <div className="mt-2 flex justify-center">
              <Link
                href={
                  returnTo
                    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
                    : "/login"
                }
                className="font-medium text-sm text-orange-600 dark:text-orange-500 hover:text-orange-500 transition-colors hover:underline"
              >
                Sign in to existing account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
