import { ForgotPasswordForm } from "./forgot-password-form";
import { LogoText } from "@/components/global/Logo";
import { CustomLink } from "@/components/global/transitions";

export const metadata = {
  title: "Forgot Password - Legal Adviser",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CustomLink
          href="/"
          className="flex justify-center cursor-pointer group lg:hidden"
        >
          <LogoText/>
        </CustomLink>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Enter your email and we&apos;ll send you a verification code.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
