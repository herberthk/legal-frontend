import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CreditCard } from "lucide-react";
import Link from "next/link";
import { CustomButton } from "../ui/custom-button";

const ExhastedBanner = () => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center p-6 dark:bg-slate-950/80 bg-slate-50/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Session Limit Reached
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            You&apos;ve run out of free voice seconds and your wallet balance is
            exhausted. Top up your account to continue this legal consultation.
          </p>

          <div className="flex flex-col gap-3">
            <CustomButton
              component={Link}
              href="/dashboard/user/billing"
              variant="transparent"
              shape="pill"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              className="bg-slate-100/50 dark:bg-slate-800/50"
              leftIcon={<CreditCard size={20} />}
              hoverEffect="glow"
            >
              Add credits now
            </CustomButton>
            <div className="w-full py-4 text-slate-600 dark:text-slate-400 font-semibold rounded-2xl">
              Session closed
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExhastedBanner;
