"use client";

import { useState } from "react";
import { cardEntrance, fadeInUp, staggerContainer } from "@/constants";
import { motion } from "framer-motion";
import {
  Gift,
  RefreshCw,
  MessageSquare,
  Mic,
  CheckCircle2,
  Sparkles,
  Zap,
  Info,
} from "lucide-react";
import Link from "next/link";

// Sourced from constants/constants.ts
const COST_PER_THOUSAND_TOKENS = 0.027;
const COST_PER_VOICE_MINUTE = 0.08;
const FREE_WELCOME_TEXT_TOKENS = 4000;
const FREE_WELCOME_VOICE_SECONDS = 120;
const FREE_DAILY_TEXT_TOKENS = 1000;
const USD_TO_UGX = 3800;

const toUGX = (usd: number) =>
  Math.round(usd * USD_TO_UGX).toLocaleString("en-UG");

// What can a user buy with UGX amounts?
const examples = [
  {
    ugx: 1000,
    tokens: Math.floor((1000 / (COST_PER_THOUSAND_TOKENS * USD_TO_UGX)) * 1000),
    voiceMinutes: (1000 / (COST_PER_VOICE_MINUTE * USD_TO_UGX)).toFixed(1),
  },
  {
    ugx: 5000,
    tokens: Math.floor((5000 / (COST_PER_THOUSAND_TOKENS * USD_TO_UGX)) * 1000),
    voiceMinutes: (5000 / (COST_PER_VOICE_MINUTE * USD_TO_UGX)).toFixed(1),
  },
  {
    ugx: 10000,
    tokens: Math.floor((10000 / (COST_PER_THOUSAND_TOKENS * USD_TO_UGX)) * 1000),
    voiceMinutes: (10000 / (COST_PER_VOICE_MINUTE * USD_TO_UGX)).toFixed(1),
  },
];

const freeFeatures = [
  "Access to all AI features",
  "Legal chat & document review",
  "Voice consultation",
  "Session history & downloads",
  "No subscription required",
];

const Pricing = () => {
  const [activeExample, setActiveExample] = useState(1);

  return (
    <section
      className="py-24 relative overflow-hidden z-10 bg-slate-50 dark:bg-[#0B1120]"
      id="pricing"
      aria-labelledby="pricing-heading"
    >
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
          style={{ willChange: "transform, opacity" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 font-bold text-sm uppercase tracking-widest mb-4">
            <Zap size={14} />
            <span>Simple Pricing</span>
          </div>
          <h2
            id="pricing-heading"
            className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4"
          >
            Start free. Pay only for{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-500 via-orange-500 to-red-500">
              what you use.
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 italic text-base md:text-lg max-w-2xl mx-auto">
            No subscriptions. No monthly fees. Load credits when you need them and pay only for the conversations and documents you process.
          </p>
        </motion.div>

        {/* Top Row: Free Tiers */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          style={{ willChange: "transform, opacity" }}
          className="grid md:grid-cols-2 gap-6 mb-6"
        >
          {/* Welcome Bonus */}
          <motion.div
            variants={cardEntrance}
            style={{ willChange: "transform" }}
            className="relative bg-linear-to-br from-indigo-600 via-purple-700 to-indigo-800 text-white p-8 rounded-3xl shadow-2xl shadow-indigo-500/30 border border-indigo-500/30 overflow-hidden"
          >
            {/* Decorative orb */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <Gift size={24} className="text-amber-300" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-0.5">
                    New User Bonus — One Time
                  </div>
                  <h3 className="text-xl font-extrabold text-white">Welcome Gift</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare size={16} className="text-indigo-200" />
                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wide">Text Tokens</span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    {FREE_WELCOME_TEXT_TOKENS.toLocaleString()}
                  </div>
                  <div className="text-xs text-indigo-200 mt-1">
                    ≈ 25–40 detailed legal questions
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Mic size={16} className="text-indigo-200" />
                    <span className="text-xs font-bold text-indigo-200 uppercase tracking-wide">Voice Minutes</span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    {FREE_WELCOME_VOICE_SECONDS / 60}
                  </div>
                  <div className="text-xs text-indigo-200 mt-1">
                    Full voice consultation session
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-indigo-100 bg-white/10 rounded-xl px-4 py-3">
                <Sparkles size={14} className="text-amber-300 shrink-0" />
                <span>Credited automatically when you create your account — no card required.</span>
              </div>
            </div>
          </motion.div>

          {/* Free Fallback */}
          <motion.div
            variants={cardEntrance}
            style={{ willChange: "transform" }}
            className="bg-white dark:bg-slate-800/60 p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <RefreshCw size={24} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-0.5">
                  Zero Balance Safety Net
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Free Top-Up
                </h3>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">Every 3 Days</span>
              </div>
              <div className="text-4xl font-black text-slate-900 dark:text-white">
                {FREE_DAILY_TEXT_TOKENS.toLocaleString()}
                <span className="text-base font-bold text-slate-500 dark:text-slate-400 ml-2">tokens</span>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                ≈ 6–8 detailed legal questions
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl text-sm">
              <Info size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-800 dark:text-amber-300">
                Your free tokens refill only after your current balance reaches <strong>zero</strong>. They don&apos;t stack — use them to unlock the next batch.
              </p>
            </div>

            <ul className="mt-5 space-y-2">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom Row: Pay-As-You-Go Rates */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          style={{ willChange: "transform, opacity" }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
          {/* Text Rate */}
          <motion.div
            variants={cardEntrance}
            style={{ willChange: "transform" }}
            className="bg-white dark:bg-slate-800/60 p-7 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                <MessageSquare size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">Text Chat & Documents</span>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                ${COST_PER_THOUSAND_TOKENS}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm ml-1">/ 1,000 tokens</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-full px-3 py-1 text-sm font-bold text-orange-700 dark:text-orange-300 mb-4">
              <span className="text-xs">UGX</span>
              {toUGX(COST_PER_THOUSAND_TOKENS)} per 1,000 tokens
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Used for AI legal chat, document review, and transcription.
            </p>
            <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs">
              <Info size={12} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-indigo-800 dark:text-indigo-300">
                Billed tokens = <strong>your message</strong> + <strong>AI thinking</strong> + <strong>AI reply</strong>. All three count toward your balance.
              </p>
            </div>
          </motion.div>

          {/* Voice Rate */}
          <motion.div
            variants={cardEntrance}
            style={{ willChange: "transform" }}
            className="bg-white dark:bg-slate-800/60 p-7 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Mic size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">Voice Consultation</span>
            </div>
            <div className="mb-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                ${COST_PER_VOICE_MINUTE}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm ml-1">/ minute</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-full px-3 py-1 text-sm font-bold text-orange-700 dark:text-orange-300 mb-4">
              <span className="text-xs">UGX</span>
              {toUGX(COST_PER_VOICE_MINUTE)} per minute
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Real-time spoken consultation with your AI legal assistant. Billed per minute of active call time.
            </p>
          </motion.div>

          {/* What you get for your money */}
          <motion.div
            variants={cardEntrance}
            style={{ willChange: "transform" }}
            className="bg-linear-to-br from-slate-900 to-slate-800 p-7 rounded-3xl border border-white/10 shadow-sm text-white"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Zap size={20} className="text-amber-400" />
              </div>
              <span className="font-bold text-white">What UGX buys you</span>
            </div>

            <div className="flex gap-2 mb-4">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setActiveExample(i)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    activeExample === i
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : "bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                >
                  {ex.ugx.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 mb-3 uppercase tracking-wider font-bold">
              For UGX {examples[activeExample].ugx.toLocaleString()} you get:
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MessageSquare size={14} className="text-indigo-400" />
                  Text tokens
                </div>
                <span className="font-black text-white text-lg">
                  {examples[activeExample].tokens.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Mic size={14} className="text-purple-400" />
                  Voice minutes
                </div>
                <span className="font-black text-white text-lg">
                  {examples[activeExample].voiceMinutes} min
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* How tokens are counted */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          style={{ willChange: "transform, opacity" }}
          className="mb-10"
        >
          <div className="bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 md:px-8 pt-8 pb-4 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <Info size={20} className="text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">How tokens are counted</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">For text chat, document review &amp; transcription</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8">
              {/* Visual flow */}
              <div className="flex flex-col md:flex-row items-stretch gap-3 mb-8">
                {/* Step 1: Your message */}
                <div className="flex-1 bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">1</div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Input Tokens</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Your Message</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    The text of your question or the contents of the document you uploaded. Longer documents = more input tokens.
                  </p>
                  <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono border border-indigo-100 dark:border-white/5">
                    &ldquo;Can a landlord evict a tenant without notice?&rdquo;
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center text-slate-300 dark:text-slate-600 text-2xl font-black self-center">+</div>
                <div className="md:hidden flex justify-center text-slate-300 dark:text-slate-600 text-2xl font-black">+</div>

                {/* Step 2: AI thinking */}
                <div className="flex-1 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">2</div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Thinking Tokens</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">AI Reasoning</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Before answering, the AI thinks through the law, considers context, and plans a thorough response. This is what makes the advice accurate.
                  </p>
                  <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono border border-amber-100 dark:border-white/5 italic">
                    &ldquo;Checking Landlord &amp; Tenant Act, s.30...&rdquo;
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden md:flex items-center text-slate-300 dark:text-slate-600 text-2xl font-black self-center">+</div>
                <div className="md:hidden flex justify-center text-slate-300 dark:text-slate-600 text-2xl font-black">+</div>

                {/* Step 3: AI reply */}
                <div className="flex-1 bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800/50 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center">3</div>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Output Tokens</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">AI&apos;s Reply</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    The full legal answer you receive — with citations, explanations, and next steps. Longer answers = more output tokens.
                  </p>
                  <div className="mt-3 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono border border-green-100 dark:border-white/5">
                    &ldquo;Under s.30 of the RTA, a landlord must give...&rdquo;
                  </div>
                </div>
              </div>

              {/* Summary row */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 p-5">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                      <span className="text-sm text-slate-600 dark:text-slate-300">Input</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">~80 tokens</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">+</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-sm text-slate-600 dark:text-slate-300">Thinking</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">~300 tokens</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-600 font-bold">+</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-slate-600 dark:text-slate-300">Output</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">~200 tokens</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 dark:text-slate-500 text-sm">=</span>
                    <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/50 rounded-xl px-4 py-2">
                      <span className="font-black text-orange-700 dark:text-orange-400">~580 tokens billed</span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      ≈ UGX {toUGX(580 / 1000 * COST_PER_THOUSAND_TOKENS)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                  * Figures above are illustrative estimates for a typical legal question. Complex documents or longer answers will use more tokens.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={fadeInUp}
          style={{ willChange: "transform, opacity" }}
          className="text-center"
        >
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            Pay via Mobile Money (MTN & Airtel). No credit card needed. Payments processed securely via PawaPay.
          </p>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ willChange: "transform" }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-full font-bold text-lg shadow-lg shadow-orange-500/30 transition-all"
            >
              <Gift size={20} />
              Claim Your Free Welcome Bonus
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
