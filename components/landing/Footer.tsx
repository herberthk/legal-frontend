import Link from "next/link";
import { fadeInUp, staggerContainer } from "@/constants";
import { motion } from "framer-motion";
import { Scale } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-[#0B1120] border-t border-slate-200 dark:border-white/5 pt-16 pb-8 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          className="grid md:grid-cols-4 gap-12 mb-12"
        >
          <motion.div variants={fadeInUp} className="col-span-1 md:col-span-2">
            <Link
              href="/"
              className="flex items-center space-x-2 mb-4 group focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg w-fit"
              aria-label="Legal Adviser Home"
            >
              <div className="bg-linear-to-br from-amber-500 to-orange-600 p-1.5 rounded-lg shadow-md">
                <Scale className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                LegalAdviser<span className="text-orange-600">UG</span>
              </span>
            </Link>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
              Democratizing access to justice in Uganda through artificial
              intelligence. We believe legal knowledge should be accessible to
              everyone, everywhere.
            </p>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              Platform
            </h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              {["Features", "Pricing", "Login", "API for Developers"].map(
                (link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1 group"
                    >
                      <span className="w-0 group-hover:w-2 h-0.5 bg-orange-500 transition-all"></span>
                      {link}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-left group flex items-center gap-1"
                >
                  <span className="w-0 group-hover:w-2 h-0.5 bg-orange-500 transition-all"></span>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  // onClick={() => onNavigate(View.PRIVACY)}
                  href="/privacy"
                  className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-left group flex items-center gap-1"
                >
                  <span className="w-0 group-hover:w-2 h-0.5 bg-orange-500 transition-all"></span>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-left group flex items-center gap-1"
                >
                  <span className="w-0 group-hover:w-2 h-0.5 bg-orange-500 transition-all"></span>
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  href="/cookie"
                  className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors text-left group flex items-center gap-1"
                >
                  <span className="w-0 group-hover:w-2 h-0.5 bg-orange-500 transition-all"></span>
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: false }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="border-t border-slate-200 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center"
        >
          <p className="text-xs text-slate-400">
            © 2024 LegalAdviser UG. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-slate-400">
            {["Twitter", "LinkedIn", "Instagram"].map((social) => (
              <Link
                key={social}
                href={`https://${social.toLowerCase()}.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orange-500 cursor-pointer transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-1"
                aria-label={`Follow us on ${social}`}
              >
                {social}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
