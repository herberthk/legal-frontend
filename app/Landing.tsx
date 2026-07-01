"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import ScrollProgressBar from "@/components/global/ScrollProgressBar";
import DemoModal from "@/components/landing/demo";
import { cardEntrance } from "@/constants";
import { usePopStore } from "@/store";
import { logAnalyticsEvent } from "@/firebase/client";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import Pricing from "@/components/landing/Pricing";
import Features from "@/components/landing/Features";
import Hero from "@/components/landing/Hero";
import HomeNavBar from "@/components/landing/HomeNavBar";
import CoreCapabilities from "@/components/landing/CoreCapabilities";
import Proof from "@/components/landing/Proof";

const LandingPage = () => {
  const showDemo = usePopStore((state) => state.showDemo);
  const { scrollYProgress } = useScroll();

  // Parallax Background Transforms
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 20]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] transition-colors duration-300 selection:bg-orange-500/30 overflow-x-hidden font-sans relative">
      {/* Scroll Progress Indicator */}
      <ScrollProgressBar />
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

        {/* Why Choose Us */}
        <Features />

        {/* Social Proof Strip */}
        <Proof/>

        {/* Core Capabilities */}
        <CoreCapabilities />

       

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
                className="px-4 py-2 md:px-8 md:py-4 rounded-full bg-white text-indigo-700 font-bold text-sm md:text-lg shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_rgba(255,255,255,0.6)] transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
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
