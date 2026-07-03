import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";
import { LogoText } from "@/components/global/Logo";
import { CustomLink } from "@/components/global/transitions";
import DirectionalTransition from "@/components/global/DirectionalTransition";

export const metadata = {
  title: "Set New Password - Legal Adviser",
  description: "Set your new password",
};

export default function ResetPasswordPage() {
  return (
    <DirectionalTransition>
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CustomLink
          href="/"
          className="flex justify-center cursor-pointer group lg:hidden"
        >
         <LogoText/>
        </CustomLink>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Set New Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Almost there! Choose a new, secure password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <Suspense
          fallback={
            <div className="bg-white dark:bg-slate-800 py-8 px-4 text-center text-slate-500 shadow-xl rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4">Loading secure form...</p>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </DirectionalTransition>
  );
}
