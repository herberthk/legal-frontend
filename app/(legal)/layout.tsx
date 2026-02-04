"use client";
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Cookie,
  FileText,
  Scale,
  Shield,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const LegalLayout = ({ children }: { children: React.ReactNode }) => {
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  let title = "";
  let subtitle = "";
  let icon = null;
  if (pathname.includes("/cookie")) {
    title = "Cookie Policy";
    subtitle = "Transparency about how we track usage and preferences.";
    icon = <Cookie size={40} className="text-blue-500" />;
  }
  if (pathname.includes("/privacy")) {
    title = "Privacy Policy";
    subtitle = "How we collect, use, and protect your personal and legal data.";
    icon = <Shield size={40} className="text-indigo-500" />;
  }
  if (pathname.includes("/terms")) {
    title = "Terms of Service";
    subtitle =
      "Please read these terms carefully before using our AI legal advisory platform.";
    icon = <FileText size={40} className="text-orange-500" />;
  }
  if (pathname.includes("/disclaimer")) {
    title = "Legal Disclaimer";
    subtitle = "Understanding the limitations of AI in legal practice.";
    icon = <AlertTriangle size={40} className="text-amber-500" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50"
      >
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-500 transition-colors group"
          >
            <ArrowLeft
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center space-x-2 opacity-0 sm:opacity-100 transition-opacity">
            <Scale className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-slate-900 dark:text-white">
              LegalAdviser<span className="text-orange-600">UG</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-slate-900 text-white py-16 md:py-24">
        <div className="absolute inset-0 bg-linear-to-br from-orange-600/20 to-indigo-600/20 z-0"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>

        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl backdrop-blur-sm mb-6 shadow-2xl border border-white/10"
          >
            {icon}
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-300 max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs font-mono text-slate-400 mt-8 uppercase tracking-widest"
          >
            Last Updated: {new Date().toLocaleDateString()}
          </motion.p>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="max-w-4xl mx-auto px-4 py-16"
      >
        <div className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-orange-600 hover:prose-a:text-orange-700 max-w-none bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          {children}
        </div>
      </motion.div>

      {/* Footer Strip */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            If you have any questions about this policy, please contact us at{" "}
            <a
              href="mailto:legal@legaladviser.ug"
              className="text-orange-600 hover:underline"
            >
              legal@legaladviser.ug
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalLayout;
