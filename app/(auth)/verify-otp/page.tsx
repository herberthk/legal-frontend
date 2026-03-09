import React, { Suspense } from "react";
import { Scale } from "lucide-react";
import Link from "next/link";
import { VerifyOtpForm } from "./verify-otp-form";

export const metadata = {
  title: "Verify Code - Legal Adviser",
  description: "Verify your password reset code",
};

export default function VerifyOtpPage() {
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
          Verify Code
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Enter the 6-digit code sent to your email
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <Suspense
          fallback={
            <div className="bg-white dark:bg-slate-800 py-8 px-4 text-center text-slate-500 shadow-xl rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4">Loading verification...</p>
            </div>
          }
        >
          <VerifyOtpForm />
        </Suspense>
      </div>
    </>
  );
}
