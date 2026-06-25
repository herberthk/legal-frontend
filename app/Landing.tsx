"use client";
import { Star } from "lucide-react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import DemoModal from "@/components/landing/demo";
import { cardEntrance, fadeInUp, staggerContainer } from "@/constants";
import { usePopStore } from "@/store";
import { logAnalyticsEvent } from "@/firebase/client";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Pricing from "@/components/landing/Pricing";
import Features from "@/components/landing/Features";
import Hero from "@/components/landing/Hero";
import HomeNavBar from "@/components/landing/HomeNavBar";
import CoreCapabilities from "@/components/landing/CoreCapabilities";

const LandingPage = () => {
  const showDemo = usePopStore((state) => state.showDemo);
  const { scrollYProgress } = useScroll();

  // Parallax Background Transforms
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 20]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] transition-colors duration-300 selection:bg-orange-500/30 overflow-x-hidden font-sans relative">
      {/* Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        Skip to main content
      </a>

      {showDemo && <DemoModal />}

      {/* Dynamic Background Glows */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none z-0"
        aria-hidden="true"
      >
        <motion.div
          style={{ y: y1, rotate, willChange: "transform" }}
          className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-500/10 dark:bg-orange-600/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen"
        />
        <motion.div
          style={{ y: y2, right: 0, willChange: "transform" }}
          className="absolute top-[20%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen"
        />
      </div>

      {/* Navbar */}
      <HomeNavBar />

      <main>
        {/* Hero Section */}
        <Hero />

        {/* Social Proof Strip */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={staggerContainer}
          style={{ willChange: "transform, opacity" }}
          className="border-y border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/5 backdrop-blur-sm py-10 z-10 relative"
          aria-label="Social Proof"
        >
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-around items-center gap-8 md:gap-12">
            <motion.div
              variants={fadeInUp}
              style={{ willChange: "transform, opacity" }}
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
              style={{ willChange: "transform, opacity" }}
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
              style={{ willChange: "transform, opacity" }}
              className="text-center group cursor-default"
            >
              <motion.p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-1 transition-all group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:scale-110 duration-300">
                24/7
              </motion.p>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold group-hover:text-orange-600/70 transition-colors">
                Availability
              </p>
            </motion.div>
            <div
              className="hidden md:block h-10 w-px bg-slate-200 dark:bg-white/10"
              aria-hidden="true"
            ></div>
            <motion.div
              variants={cardEntrance}
              style={{ willChange: "transform, opacity" }}
              className="flex items-center space-x-2"
            >
              <div className="flex -space-x-2" aria-label="User testimonials">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-md"
                  >
                    <Image
                      src={`https://ui-avatars.com/api/?name=User+${i}&background=random`}
                      alt={`User avatar ${i}`}
                      width={40}
                      height={40}
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <div className="text-left ml-2">
                <div
                  className="flex text-amber-400 drop-shadow-sm"
                  aria-label="5 out of 5 stars"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Rated 4.9/5 by Ugandans
                </p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Core Capabilities */}
        <CoreCapabilities />

        {/* Why Choose Us */}
        <Features />

        {/* Pricing Section */}
        <Pricing />

        {/* FAQ Section */}
        <Faq />

        {/* Final CTA */}
        <section
          className="py-20 px-4 relative z-10"
          aria-labelledby="cta-heading"
        >
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={cardEntrance}
            style={{ willChange: "transform, opacity" }}
            className="max-w-5xl mx-auto bg-linear-to-br from-indigo-600 via-purple-700 to-indigo-800 rounded-3xl p-10 md:p-16 text-center shadow-2xl shadow-indigo-500/30 relative overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"
              aria-hidden="true"
            ></div>
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
              transition={{ duration: 20, repeat: Infinity }}
              style={{ willChange: "transform" }}
              className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
              aria-hidden="true"
            ></motion.div>

            <div className="relative z-10">
              <h2
                id="cta-heading"
                className="text-3xl md:text-5xl font-extrabold text-white mb-6 drop-shadow-md"
              >
                Ready to know your rights?
              </h2>
              <p className="text-lg md:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
                Claim your 4,000 free tokens and 2 minutes of voice consultation
                today.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ willChange: "transform" }}
                onClick={() => {
                  logAnalyticsEvent("final_cta_click");
                }}
                className="px-10 py-4 rounded-full bg-white text-indigo-700 font-bold text-lg shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
              >
                Get Started for Free
              </motion.button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer with Animations */}
      <Footer />
    </div>
  );
};

export default LandingPage;
