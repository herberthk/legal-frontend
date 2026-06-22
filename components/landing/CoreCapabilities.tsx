"use client";

import { motion } from "framer-motion";
import { coreCapabilities } from "@/constants";
import { fadeInUp, staggerContainer, cardEntrance } from "@/constants";
import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import Image from "next/image";

const FeatureShowcase = ({ 
  imageDesktop, 
  imageMobile, 
  color 
}: { 
  imageDesktop: string, 
  imageMobile: string, 
  color: string 
}) => {
  return (
    <div className="relative w-full aspect-[4/3] md:aspect-video lg:aspect-[4/3] xl:aspect-video flex items-center justify-center pt-8 pr-8 pb-16 md:pb-8 perspective-[2000px]">
      {/* Background glow behind the screens */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 0.6, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        viewport={{ once: false, amount: 0.2 }}
        className={`absolute inset-0 bg-${color}-500/20 blur-[80px] rounded-full dark:opacity-40 -z-10`}
      ></motion.div>
      
      {/* Desktop Browser Frame */}
      <motion.div 
        initial={{ y: 80, opacity: 0, rotateX: 15, scale: 0.9 }}
        whileInView={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", type: "spring", bounce: 0.2 }}
        viewport={{ once: false, amount: 0.3 }}
        style={{ willChange: "transform, opacity" }}
        className="w-11/12 md:w-5/6 relative bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 z-10"
      >
        {/* Browser Top Bar */}
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-white/5 p-2 md:p-3 flex items-center gap-1.5 md:gap-2">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-400"></div>
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-400"></div>
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-400"></div>
        </div>
        {/* Desktop Screenshot */}
        <div className="relative aspect-video w-full bg-slate-50 dark:bg-slate-900">
          <Image 
            src={imageDesktop} 
            alt="Desktop Interface" 
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={false}
          />
        </div>
      </motion.div>

      {/* Mobile Device Frame */}
      <motion.div 
        initial={{ x: 50, y: 80, opacity: 0, rotateZ: 10, scale: 0.8 }}
        whileInView={{ x: 0, y: [0, -15, 0], opacity: 1, rotateZ: [-5, 0, -5], scale: 1 }}
        transition={{ 
          opacity: { duration: 0.5, delay: 0.2 },
          scale: { duration: 0.6, delay: 0.2, type: "spring", bounce: 0.4 },
          x: { duration: 0.6, delay: 0.2, type: "spring", bounce: 0.4 },
          y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
          rotateZ: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }
        }}
        viewport={{ once: false, amount: 0.3 }}
        style={{ willChange: "transform, opacity" }}
        className="absolute bottom-0 right-0 md:-right-8 w-1/3 min-w-[120px] max-w-[200px] bg-slate-900 dark:bg-black rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-1.5 md:p-2 border-4 border-slate-800 dark:border-slate-700 z-20"
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-4 bg-slate-900 dark:bg-black rounded-b-xl z-30"></div>
        
        {/* Mobile Screenshot */}
        <div className="relative w-full aspect-[9/19.5] rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-slate-50 dark:bg-slate-900">
          <Image 
            src={imageMobile} 
            alt="Mobile Interface" 
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 33vw, 20vw"
            priority={false}
          />
        </div>
      </motion.div>
    </div>
  );
};

const CoreCapabilities = () => {
  return (
    <section className="py-24 relative z-10 overflow-hidden" id="capabilities">
      {/* Background embellishments */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px]"
          style={{ willChange: "transform" }}
        ></motion.div>
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-[120px]"
          style={{ willChange: "transform" }}
        ></motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-bold text-sm uppercase tracking-widest mb-4">
            <Sparkles size={16} />
            <span>Core Capabilities</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">
            Everything you need for legal clarity.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl">
            From analyzing complex contracts to providing instant, spoken legal guidance, our suite of AI-powered tools is designed to empower you.
          </p>
        </motion.div>

        <div className="space-y-32">
          {coreCapabilities.map((capability, idx) => {
            const isEven = idx % 2 === 0;

            return (
              <motion.div
                key={idx}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={staggerContainer}
                className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} items-center gap-12 lg:gap-20`}
              >
                {/* Text Content */}
                <motion.div variants={fadeInUp} className="w-full lg:w-1/2 space-y-5">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-${capability.color}-100 dark:bg-${capability.color}-900/20 text-${capability.color}-600 dark:text-${capability.color}-400 flex items-center justify-center shadow-lg`}>
                    <capability.icon size={32} />
                  </div>

                  {/* Badge */}
                  {capability.badge && (
                    <div className={`inline-flex items-center px-3 py-1 rounded-full bg-${capability.color}-50 dark:bg-${capability.color}-900/20 border border-${capability.color}-200 dark:border-${capability.color}-800/50 text-${capability.color}-700 dark:text-${capability.color}-400 text-xs font-bold uppercase tracking-wider`}>
                      {capability.badge}
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                    {capability.title}
                  </h3>

                  {/* Description */}
                  <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                    {capability.desc}
                  </p>

                  {/* Highlights */}
                  {capability.highlights && capability.highlights.length > 0 && (
                    <ul className="space-y-3">
                      {capability.highlights.map((point: string, i: number) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * i, duration: 0.4, ease: "easeOut" }}
                          viewport={{ once: true }}
                          style={{ willChange: "transform, opacity" }}
                          className="flex items-start gap-3"
                        >
                          <CheckCircle2
                            size={18}
                            className={`text-${capability.color}-500 shrink-0 mt-0.5`}
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
                            {point}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  )}

                  {/* CTA */}
                  <div className="pt-2">
                    <Link href={capability.href}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`group inline-flex items-center gap-2 px-8 py-4 bg-${capability.color}-600 hover:bg-${capability.color}-700 text-white rounded-full font-bold text-lg transition-colors shadow-lg shadow-${capability.color}-500/30`}
                        style={{ willChange: "transform" }}
                      >
                        {capability.buttonText}
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </Link>
                  </div>
                </motion.div>

                {/* Screenshots Gallery */}
                <div className="w-full lg:w-1/2">
                  <FeatureShowcase 
                    imageDesktop={capability.imageDesktop!} 
                    imageMobile={capability.imageMobile!} 
                    color={capability.color} 
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CoreCapabilities;
