"use client";
import React, { useState } from "react";
import { Scale, Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { signUp, signIn } from "@/lib/actions/auth";

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
          router.push(returnTo || "/dashboard/user");
        } else {
          setError(
            sessionResult?.message ||
              "Profile created, but failed to start session. Please log in.",
          );
        }
      } else {
        setError(profileResult.message);
      }
    } catch (err: unknown) {
      console.error("Signup Error:", err);
      const firebaseError = err as { code: string };
      if (firebaseError.code === "auth/email-already-in-use") {
        setError("This email is already in use.");
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError("An error occurred during signup. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Link href="/" className="flex justify-center cursor-pointer group">
          <div className="bg-linear-to-br from-amber-500 to-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-500/20 transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
            <Scale className="w-10 h-10 text-white" />
          </div>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Create Account
        </h2>

        {/* Role Toggles */}
        {/* <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => setSelectedRole("USER")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedRole === "USER"
                ? "bg-orange-100 text-orange-700 ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900"
                : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <UserIcon size={16} />
            <span>Client</span>
          </button>
          <button
            onClick={() => setSelectedRole("ADMIN")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedRole === "ADMIN"
                ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900"
                : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            <Shield size={16} />
            <span>Admin</span>
          </button>
        </div> */}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-950 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700 transition-all duration-300">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </div>
            )}
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
                  className="appearance-none block w-full px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
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
                  className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
                  placeholder="account@example.com"
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
                  className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 focus:ring-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 hover:shadow-lg"
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
