"use client";
import { CustomLink } from "@/components/global/transitions";
import { Scale, Home, ArrowLeft, FileQuestion } from "lucide-react";
import { useRouter } from "nextjs-toploader/app";

const NotFoundPage = () => {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-orange-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-200/20 dark:bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-200/20 dark:bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-2xl w-full">
        {/* Logo/Icon at the top */}
        <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-linear-to-br from-amber-500 to-orange-600 p-4 rounded-2xl shadow-xl shadow-orange-500/30 transform transition-transform duration-500 hover:rotate-12 hover:scale-110">
            <Scale className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Main content */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* 404 Number with animation */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <h1 className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-linear-to-r from-amber-500 via-orange-600 to-amber-500 animate-gradient-x tracking-tight">
                404
              </h1>
              <div className="absolute -top-4 -right-4 animate-bounce">
                <FileQuestion className="w-16 h-16 text-orange-500/50" />
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Page Not Found
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg max-w-md mx-auto">
              The legal document you&apos;re looking for seems to have been
              misplaced. Let&apos;s get you back on track.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CustomLink
              href="/"
              className="group w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-300 transform hover:scale-105 active:scale-95 hover:shadow-xl"
            >
              <Home size={20} />
              <span className="font-medium">Go Home</span>
            </CustomLink>

            <button
              onClick={() => router.back()}
              className="group w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              <ArrowLeft
                size={20}
                className="group-hover:-translate-x-1 transition-transform"
              />
              <span className="font-medium">Go Back</span>
            </button>
          </div>

          {/* Additional helpful links */}
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">
              Helpful Links:
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <CustomLink
                href="/dashboard"
                className="text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors hover:underline"
              >
                Dashboard
              </CustomLink>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <CustomLink
                href="/dashboard/help"
                className="text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors hover:underline"
              >
                Help & Support
              </CustomLink>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <CustomLink
                href="/login"
                className="text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors hover:underline"
              >
                Sign In
              </CustomLink>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400 animate-in fade-in duration-1000 delay-500">
          Lost in the legal labyrinth? We&apos;ll help you find your way.
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
