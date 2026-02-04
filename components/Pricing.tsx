import { cardEntrance, fadeInUp, staggerContainer } from "@/constants";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const Pricing = () => {
  return (
    <section
      className="py-24 relative overflow-hidden z-10 bg-slate-50 dark:bg-[#0B1120]"
      id="pricing"
    >
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.5 }}
          variants={fadeInUp}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
            Start with free messages every day. Pay only for what you need
            beyond that.
          </p>

          {/* Billing Toggle Visual */}
          <div className="mt-8 flex justify-center items-center space-x-3">
            <span className="text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              Pay As You Go
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.1 }}
          className="grid lg:grid-cols-3 gap-8 items-center perspective-1000"
        >
          {/* Free Tier */}
          <motion.div
            variants={cardEntrance}
            whileHover={{
              y: -10,
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
              transition: { type: "spring", stiffness: 300, damping: 25 },
            }}
            className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Basic Access
            </h3>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                Free
              </span>
              <span className="text-slate-500 ml-2">/ forever</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Perfect for quick legal definitions and simple constitution
              lookups.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {}}
              className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Get Started
            </motion.button>
            <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" /> 1,000 Free
                Text Tokens / day
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" />{" "}
                <span className="font-bold mr-1">Welcome Bonus:</span> 4,000
                Tokens
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" />{" "}
                <span className="font-bold mr-1">Welcome Bonus:</span> 5 Mins
                Voice
              </li>
            </ul>
          </motion.div>

          {/* Flexible Credits (Highlighted) */}
          <motion.div
            variants={cardEntrance}
            whileHover={{
              y: -15,
              scale: 1.05,
              boxShadow: "0 35px 60px -15px rgba(79, 70, 229, 0.3)",
              transition: { type: "spring", stiffness: 300, damping: 25 },
            }}
            className="bg-linear-to-br from-indigo-600 via-purple-700 to-indigo-800 text-white p-8 rounded-3xl shadow-2xl shadow-indigo-500/30 border border-indigo-500/50 relative z-10 transform scale-105"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-linear-to-r from-amber-400 to-orange-500 text-slate-900 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg animate-pulse">
              Best Value
            </div>
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-linear-to-r from-white to-indigo-200">
              Flexible Credits
            </h3>
            <div className="my-6">
              <span className="text-5xl font-extrabold inline-block text-white drop-shadow-sm">
                $0.03
              </span>
              <span className="text-indigo-200 ml-2">/ 1k tokens</span>
            </div>
            <p className="text-sm text-indigo-100 mb-6">
              Load credits and pay only for exact usage. No expiry.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {}}
              className="w-full py-3 px-4 rounded-xl bg-white text-indigo-700 font-bold shadow-lg transition-all hover:bg-indigo-50"
            >
              Load Credits
            </motion.button>
            <ul className="mt-8 space-y-4 text-sm text-indigo-100">
              <li className="flex items-center">
                <Check size={16} className="text-indigo-300 mr-3" /> Text Chat:
                $0.03 / 1000 Tokens
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-indigo-300 mr-3" /> Voice Chat:
                $0.05 / Minute
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-indigo-300 mr-3" /> Document
                Analysis Included
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-indigo-300 mr-3" /> Priority
                Processing
              </li>
            </ul>
          </motion.div>

          {/* Enterprise Tier */}
          <motion.div
            variants={cardEntrance}
            whileHover={{
              y: -10,
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
              transition: { type: "spring", stiffness: 300, damping: 25 },
            }}
            className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Legal Firm
            </h3>
            <div className="my-6">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                Custom
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              For small firms and NGOs requiring bulk research capabilities.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {}}
              className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Contact Sales
            </motion.button>
            <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" /> Bulk Token
                Discounts
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" /> Multiple
                User Seats
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" /> API Access
              </li>
              <li className="flex items-center">
                <Check size={16} className="text-green-500 mr-3" /> Dedicated
                Support
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
