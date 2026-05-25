import { X, Coins, CreditCard, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

type Props = {
  billingError: string;
  dismissBillingBanner: () => void;
};
const BillingError = ({ billingError, dismissBillingBanner }: Props) => {
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Billing notice"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismissBillingBanner}
      />

      {/* Card */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {/* Glow ring */}
        <div className="absolute -inset-px rounded-2xl bg-linear-to-br from-orange-400 via-amber-400 to-red-500 opacity-60 blur-sm" />

        <div className="relative rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 bg-linear-to-r from-orange-400 via-amber-400 to-red-500" />

          {/* Close button */}
          <button
            onClick={dismissBillingBanner}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="p-8">
            {/* Icon badge */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-linear-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 flex items-center justify-center shadow-inner">
                  <Lock
                    size={28}
                    className="text-orange-500 dark:text-orange-400"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow">
                  <Coins size={12} className="text-white" />
                </span>
              </div>
            </div>

            {/* Text */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Access Restricted
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {billingError}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link
                href="/dashboard/billing"
                className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm shadow-md shadow-orange-500/30 transition-all duration-200 hover:shadow-orange-500/50 hover:-translate-y-0.5"
              >
                <CreditCard size={15} />
                Top Up Balance
                <ArrowRight size={14} className="ml-auto" />
              </Link>
              <button
                onClick={dismissBillingBanner}
                className="w-full py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-150"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingError;
