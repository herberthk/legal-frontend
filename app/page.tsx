"use client";
import { Scale, Sun, Moon, Star } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import DemoModal from "@/components/landing/demo";
import { cardEntrance, fadeInUp, staggerContainer } from "@/constants";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePopStore, useThemeStore } from "@/store";
import { logAnalyticsEvent } from "@/firebase/client";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Pricing from "@/components/landing/Pricing";
import Features from "@/components/landing/Features";
import Hero from "@/components/landing/Hero";

const LandingPage = () => {
  const showDemo = usePopStore((state) => state.showDemo);
  const { scrollYProgress } = useScroll();
  const router = useRouter();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  // Parallax Background Transforms
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 20]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] transition-colors duration-300 selection:bg-orange-500/30 overflow-x-hidden font-sans relative">
      {showDemo && <DemoModal />}

      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          style={{ y: y1, rotate }}
          className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 dark:bg-orange-600/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
        />
        <motion.div
          style={{ y: y2, right: 0 }}
          className="absolute top-[20%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
        />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
        className="fixed top-0 w-full z-50 bg-white/70 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-white/20 dark:border-white/5 transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 group cursor-pointer"
            onClick={() => {
              logAnalyticsEvent("navbar_logo_click");
              router.push("/login");
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-amber-500 to-orange-600 blur opacity-40 group-hover:opacity-70 transition-opacity rounded-xl"></div>
              <div className="relative bg-linear-to-br from-amber-500 to-orange-600 p-2 rounded-xl shadow-lg border border-white/20">
                <Scale className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              LegalAdviser
              <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-500 to-orange-600">
                UG
              </span>
            </span>
          </motion.div>

          <div className="hidden md:flex items-center space-x-8">
            {["Features", "Pricing", "FAQ"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-linear-to-r from-amber-500 to-orange-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ rotate: 180, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.3 }}
              onClick={toggleTheme}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            >
              {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
            </motion.button>
            <Link href="/login" onClick={() => logAnalyticsEvent("client_login_click")}>
              <motion.button
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)",
                }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex px-6 py-2.5 rounded-full bg-slate-900 text-white font-bold text-sm shadow-xl transition-all border border-transparent hover:border-orange-500/50 dark:bg-linear-to-r dark:from-indigo-500 dark:to-purple-600 dark:hover:from-indigo-600 dark:hover:to-purple-700 dark:focus:ring-indigo-500"
              >
                Client Login
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <Hero />

      {/* Social Proof Strip */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.5 }}
        variants={staggerContainer}
        className="border-y border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-sm py-10 z-10 relative"
      >
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-around items-center gap-8 md:gap-12">
          <motion.div
            variants={fadeInUp}
            className="text-center group cursor-default"
          >
            <motion.p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
              5,000+
            </motion.p>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
              Cases Analyzed
            </p>
          </motion.div>
          <motion.div
            variants={fadeInUp}
            className="text-center group cursor-default"
          >
            <motion.p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
              98%
            </motion.p>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
              Accuracy Rate
            </p>
          </motion.div>
          <motion.div
            variants={fadeInUp}
            className="text-center group cursor-default"
          >
            <motion.p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
              24/7
            </motion.p>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
              Availability
            </p>
          </motion.div>
          <div className="hidden md:block h-10 w-px bg-slate-200 dark:bg-white/10"></div>
          <motion.div
            variants={cardEntrance}
            className="flex items-center space-x-2"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-md"
                >
                  <img
                    src={`https://ui-avatars.com/api/?name=User+${i}&background=random`}
                    alt="User"
                  />
                </div>
              ))}
            </div>
            <div className="text-left ml-2">
              <div className="flex text-amber-400 drop-shadow-sm">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill="currentColor" />
                ))}
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Rated 4.9/5 by Ugandans
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Why Choose Us */}
      <Features />

      {/* Pricing Section */}
      <Pricing />

      {/* FAQ Section */}
      <Faq />
      {/* Final CTA */}
      <section className="py-20 px-4 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.5 }}
          variants={cardEntrance}
          className="max-w-5xl mx-auto bg-linear-to-br from-indigo-600 via-purple-700 to-indigo-800 rounded-3xl p-10 md:p-16 text-center shadow-2xl shadow-indigo-500/30 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
          ></motion.div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 drop-shadow-md">
              Ready to know your rights?
            </h2>
            <p className="text-lg md:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
              Claim your 4,000 free tokens and 5 minutes of voice consultation
              today.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                logAnalyticsEvent("final_cta_click");
              }}
              className="px-10 py-4 rounded-full bg-white text-indigo-700 font-bold text-lg shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] transition-all"
            >
              Get Started for Free
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Footer with Animations */}
      <Footer />
    </div>
  );
};

export default LandingPage;
