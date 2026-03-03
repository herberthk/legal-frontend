"use client";
import React, { useState } from "react";
import { Scale, Mail, Lock, ArrowRight, Shield, UserIcon } from "lucide-react";
import Link from "next/link";
import { createSession } from "@/lib";
import { useRouter, useSearchParams } from "next/navigation";

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("USER");
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const mockUser: User =
      selectedRole === "ADMIN"
        ? {
            id: "admin-01",
            name: "James Anderson",
            email: "admin@legaladviser.ug",
            avatar:
              "https://ui-avatars.com/api/?name=Admin+User&background=0f172a&color=fff",
            role: "ADMIN",
            balance: 0,
            totalSpent: 0,
            status: "active",
            freeTextTokens: 1000,
            welcomeTextTokens: 0, // Admin doesn't need welcome bonus
            freeVoiceSeconds: 300,
            lastDailyReset: new Date().toISOString(),
          }
        : {
            id: "user-01",
            name: "Herbert Kavuma",
            email: "citizen@uganda.com",
            avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
            role: "USER",
            balance: 0.0, // Reset to 0 for new user logic
            totalSpent: 0.0,
            status: "active",
            // Specific Welcome Bonus: 4000 Tokens + 5 Mins Voice
            welcomeTextTokens: 4000,
            freeTextTokens: 1000, // Daily limit available after welcome is used (or parallel depending on logic, but logic enforces priority)
            freeVoiceSeconds: 300,
            lastDailyReset: new Date().toISOString(),
          };
    await createSession(mockUser);
    setLoading(false);
    const defaultPath =
      selectedRole === "ADMIN" ? "/dashboard/admin" : "/dashboard/user";
    router.push(returnTo || defaultPath);
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
          Sign in to Portal
        </h2>

        {/* Role Toggles */}
        <div className="mt-6 flex justify-center space-x-4">
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
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl shadow-slate-200 dark:shadow-slate-950 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700 transition-all duration-300">
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
                  className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent sm:text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform focus:scale-[1.01]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95 hover:shadow-lg ${
                selectedRole === "ADMIN"
                  ? "bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:ring-indigo-500"
                  : "bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 focus:ring-orange-500"
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span className="flex items-center group">
                  {`Sign In as ${selectedRole === "ADMIN" ? "Admin" : "Client"}`}
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
