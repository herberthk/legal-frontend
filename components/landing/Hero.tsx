"use client";
import { fadeInUp, mockChatVariants, staggerContainer } from "@/constants";
import { motion } from "framer-motion";
import { Check, PlayCircle, Scale } from "lucide-react";
import { usePopStore } from "@/store";
import { CustomButton } from "../ui/custom-button";

const Hero = () => {
  const setShowDemo = usePopStore((state) => state.setShowDemo);
  return (
    <section
      className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 overflow-hidden z-10"
      aria-label="Introduction"
      id="hero"
    >
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: Content */}
        <motion.div
          style={{ willChange: "transform, opacity" }}
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          className="text-center lg:text-left relative z-20"
        >
          <motion.div variants={fadeInUp} style={{ willChange: "transform, opacity" }}>
            <div className="inline-flex items-center px-2 md:px-4 py-1 md:py-2 rounded-full bg-orange-500/10 border border-orange-500/20  mb-8 cursor-default backdrop-blur-sm shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-orange-700 dark:text-orange-300 text-xs italic">
                Ask about Uganda&apos;s Constitution, Acts of Parliament,
                and Statutory Instruments.
              </span>
            </div>
          </motion.div>

          <motion.h1
            style={{ willChange: "transform, opacity" }}
            variants={fadeInUp}
            className="text-4xl md:text-7xl font-extrabold  tracking-tight mb-6 leading-[1.1]"
          >
           <span className="text-slate-900 dark:text-white">Legal Counsel </span><br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-500 via-orange-500 to-red-500 animate-gradient-x">
              Without Barriers.
            </span>
          </motion.h1>

          <motion.p
            style={{ willChange: "transform, opacity" }}
            variants={fadeInUp}
            className="text-sm md:text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0 italic"
          >
            Navigate the Ugandan Constitution, Acts of Parliament, and all statutory instruments with an AI assistants that were trained on all Ugandan Laws (company act 2012, Employment Act, 2006, Landlord and Tenant Act, 2022, etc) with verified citations (Act, section, Article, clause etc)
          </motion.p>

          <motion.div
            style={{ willChange: "transform, opacity" }}
            variants={fadeInUp}
            className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4"
          >
            {/* <CustomButton
              component={Link}
              href="/login"
              variant="gradient-mixed"
              size="lg"
              hoverEffect="tilt"
              shape="pill"
              shadow="2xl"
              rightIcon={<ArrowRight />}
              className="px-8 h-14 text-lg font-bold"
            >
              Start Free Consultation
            </CustomButton> */}

            <CustomButton
              size="lg"
              hoverEffect="glow"
              variant="transparent"
              shape="rounded"
              borderLeftWidth="4px"
              borderLeftColor="#4f46e5"
              borderRightWidth="4px"
              borderRightColor="#ea580c"
              leftIcon={<PlayCircle className="text-orange-500" />}
              onClick={() => setShowDemo(true)}
              className="px-8 h-14 rounded-xl text-lg font-bold bg-white/50 dark:bg-white/5 backdrop-blur-md"
            >
              Watch Demo
            </CustomButton>
          </motion.div>

          <motion.div
            style={{ willChange: "transform, opacity" }}
            variants={fadeInUp}
            className="mt-10 flex items-center justify-center lg:justify-start space-x-6 text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" /> 24/7
              Availability
            </div>
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" /> Verified
              Citations
            </div>
            <div className="flex items-center">
              <Check className="w-4 h-4 text-green-500 mr-2" /> Voice Enabled
            </div>
          </motion.div>
        </motion.div>

        {/* Right: UI Mockup Graphic */}
        <motion.div
          initial="hidden"
          whileInView={["visible", "float"]}
          viewport={{ once: false, amount: 0.3 }}
          variants={mockChatVariants}
          style={{ perspective: 1000, willChange: "transform, opacity" }}
          className="relative hidden lg:block"
          aria-hidden="true"
        >
          {/* Glowing Ring */}
          <div className="absolute inset-0 bg-linear-to-tr from-amber-500/30 to-purple-600/30 rounded-full blur-[60px] opacity-40 animate-pulse"></div>

          {/* Chat Interface Mockup */}
          <motion.div
            style={{ willChange: "transform" }}
            className="relative bg-white/80 dark:bg-[#111827]/90 rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden max-w-md mx-auto"
            whileHover={{ rotateY: -5, rotateX: 5, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            {/* Mock Header */}
            <div className="px-3 md:px-6 py-2 md:py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center space-x-4">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 py-1 px-3 rounded-full">
                  Live Session
                </span>
              </div>
            </div>

            {/* Mock Messages */}
            <div className="p-2 md:p-6 space-y-3 md:space-y-6">
              {/* User Msg */}
              <motion.div
                style={{ willChange: "transform, opacity" }}
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                viewport={{ once: false }}
                className="flex items-end justify-end space-x-2"
              >
                <div className="bg-linear-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-2xl rounded-br-sm text-sm font-medium max-w-[85%] shadow-sm border border-slate-200 dark:border-slate-700">
                  How do I register a customary land title in Uganda?
                </div>
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  U
                </div>
              </motion.div>

              {/* AI Msg */}
              <motion.div
                style={{ willChange: "transform, opacity" }}
                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 1.2, type: "spring" }}
                viewport={{ once: false }}
                className="flex items-start space-x-3"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
                  <Scale size={14} />
                </div>
                <div className="space-y-2 max-w-[85%]">
                  <div className="bg-orange-50 dark:bg-orange-900/10 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed shadow-sm border border-orange-100 dark:border-orange-900/30">
                    <p className="mb-2">
                      According to the{" "}
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        Land Act, 1998
                      </span>
                      , you need to apply for a Certificate of Customary
                      Ownership (CCO).
                    </p>
                    <ul className="list-disc pl-4 space-y-1 opacity-90">
                      <li>Submit application to Area Land Committee.</li>
                      <li>Public notice for 14 days.</li>
                      <li>Adjudication by the Committee.</li>
                    </ul>
                  </div>
                  <div className="flex gap-2 opacity-70">
                    <span className="text-[10px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-white/10">
                      Tokens: 145
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-white/5 px-2 py-1 rounded text-slate-500 dark:text-slate-400 font-mono border border-slate-200 dark:border-white/10">
                      Time: 0.8s
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Mock Input */}
            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#111827]">
              <div className="h-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl w-full flex items-center px-4 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full ml-3 opacity-50"></div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
