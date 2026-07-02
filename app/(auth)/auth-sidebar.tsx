"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { LogoText } from "@/components/global/Logo";
import { CustomLink } from "@/components/global/transitions";

export const AuthSidebar = () => {
  const pathname = usePathname();

  let title = "Welcome to Legal Adviser";
  let description =
    "Your professional portal for legal and compliance management.";

  if (pathname === "/login") {
    title = "Welcome Back!";
    description =
      "Sign in to your account to securely access your legal documents and manage your portal.";
  } else if (pathname === "/signup") {
    title = "Start Your Journey";
    description =
      "Create an account to securely access legal advice, track compliance, and manage documents seamlessly.";
  } else if (pathname === "/forgot-password") {
    title = "Reset Your Password";
    description =
      "Don't worry, we'll help you get back into your account securely in just a few steps.";
  } else if (pathname === "/verify-otp") {
    title = "Verify Your Identity";
    description =
      "To ensure security, please enter the temporary code we just sent to your email.";
  } else if (pathname === "/reset") {
    title = "Secure Your Account";
    description =
      "Choose a strong, new password to keep your portal and documents safe.";
  }

  return (
    <div className="hidden lg:flex flex-col justify-center w-[42%] bg-slate-950 dark:bg-[#020617] p-12 relative overflow-hidden shrink-0 border-r border-slate-200 dark:border-slate-800/50">
      {/* Dynamic Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Professional Linear Gradient Overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-indigo-600/20 via-transparent to-orange-500/10 pointer-events-none" />

      {/* Subtle Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none transform -translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 mb-16">
        <CustomLink href="/">
          <LogoText />
        </CustomLink>
      </div>

      <div className="relative z-10 max-w-[320px]">
        <h1 className="text-4xl font-extrabold text-white mb-6 leading-[1.1] tracking-tight animate-in slide-in-from-bottom-4 fade-in duration-700">
          {pathname === "/verify-otp" ? "Identity Verification" : title}
        </h1>
        <p className="text-base text-slate-400 animate-in slide-in-from-bottom-8 fade-in duration-1000 leading-relaxed font-medium">
          {pathname === "/verify-otp"
            ? "Secure access with a one-time code sent to your registered email."
            : description}
        </p>
      </div>

      {/* Feature Checkmarks (visible mainly on login/signup) */}
      {(pathname === "/login" || pathname === "/signup") && (
        <div className="relative z-10 mt-16 space-y-4 animate-in slide-in-from-bottom-12 fade-in duration-1000">
          <div className="flex items-center gap-4 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xs p-4 rounded-2xl border border-white/10 dark:border-slate-800/50 hover:border-indigo-500/30 transition-all duration-300 group hover:translate-x-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0 transform transition-transform group-hover:scale-110">
              <svg
                className="w-5 h-5 text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[10px] opacity-60 mb-0.5">
                Asset Security
              </h3>
              <p className="text-sm font-semibold text-slate-200">
                Military-Grade Encryption
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xs p-4 rounded-2xl border border-white/10 dark:border-slate-800/50 hover:border-indigo-500/30 transition-all duration-300 group hover:translate-x-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 transform transition-transform group-hover:scale-110">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[10px] opacity-60 mb-0.5">
                Compliance
              </h3>
              <p className="text-sm font-semibold text-slate-200">
                Global Legal Standards
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-12 left-12 text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
        &copy; {new Date().getFullYear()} Legal Adviser System
      </div>
    </div>
  );
};
