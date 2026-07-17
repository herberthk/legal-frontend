import {
  USD_TO_UGX_EXCHANGE_RATE,
  COST_PER_THOUSAND_TOKENS,
  FREE_WELCOME_TEXT_TOKENS,
  FREE_TEXT_TOKENS,
  COST_PER_VOICE_MINUTE,
  FREE_WELCOME_VOICE_SECONDS,
} from "@/constants";
import { FC, useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  AlertCircle,
  Gift,
  MessageSquareIcon,
  MicIcon,
  Clock,
  Sparkles,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { CustomLink } from "../global/transitions";

type Prop = {
  user: User;
};

const UsageCards: FC<Prop> = ({ user }) => {
  // De-structure for stable dependencies and compiler compatibility
  const balance = user?.balance ?? 0;
  const welcomeTextTokens = user?.welcomeTextTokens ?? 0;
  const freeTextTokens = user?.freeTextTokens ?? 0;
  const freeVoiceSeconds = user?.freeVoiceSeconds ?? 0;
  const nextDailyReset = user?.nextDailyReset;

  // --- Limits Logic (Memoized for Performance) ---
  const {
    hasBalance,
    hasWelcomeTokens,
    hasFreeTextTokens,
    hasFreeVoiceSeconds,
    showTextWarning,
    showVoiceWarning,
  } = useMemo(() => {
    return {
      hasBalance: balance > 0,
      hasWelcomeTokens: welcomeTextTokens > 0,
      hasFreeTextTokens: freeTextTokens > 0,
      hasFreeVoiceSeconds: freeVoiceSeconds > 0,
      showTextWarning:
        balance <= 0 && welcomeTextTokens <= 0 && freeTextTokens <= 0,
      showVoiceWarning: balance <= 0 && freeVoiceSeconds <= 0,
    };
  }, [balance, welcomeTextTokens, freeTextTokens, freeVoiceSeconds]);

  // Wallet Equivalence (Memoized)
  const { potentialTokens, potentialVoiceMins } = useMemo(() => {
    return {
      potentialTokens: Math.floor(
        (balance / 100 / COST_PER_THOUSAND_TOKENS) * 1000,
      ),
      potentialVoiceMins: Math.floor(balance / 100 / COST_PER_VOICE_MINUTE),
    };
  }, [balance]);

  // --- Countdown Logic ---
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null>(null);

  const calculateTimeLeft = useCallback(() => {
    if (!nextDailyReset) return null;
    const targetDate = new Date(nextDailyReset).getTime();
    const now = new Date().getTime();
    const difference = targetDate - now;

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      totalSeconds: Math.floor(difference / 1000),
    };
  }, [nextDailyReset]);

  useEffect(() => {
    if (!nextDailyReset) return;

    const initial = calculateTimeLeft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setTimeLeft(initial);

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      if (remaining) {
        setTimeLeft(remaining);
        if (remaining.totalSeconds <= 0) {
          clearInterval(timer);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextDailyReset, calculateTimeLeft]);

  // 5 days in seconds = 5 * 24 * 60 * 60 = 432000
  const TOTAL_RESET_SECONDS = 432000;
  const totalSecondsRemaining = timeLeft?.totalSeconds;

  const progressPercent = useMemo(() => {
    if (totalSecondsRemaining === undefined) return 0;
    if (totalSecondsRemaining <= 0) return 100;
    return Math.max(
      0,
      Math.min(100, (1 - totalSecondsRemaining / TOTAL_RESET_SECONDS) * 100),
    );
  }, [totalSecondsRemaining]);

  const isResetOverdue = totalSecondsRemaining !== undefined && totalSecondsRemaining <= 0;


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Main Balance */}
      <div className="bg-white dark:bg-linear-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl md:p-6 p-3 shadow-xl border border-slate-100 dark:border-transparent relative overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:rotate-12 group-hover:scale-110">
          <Scale size={100} className="text-slate-900 dark:text-white" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-medium mb-1 flex items-center gap-2">
          Wallet Balance
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">
            Paid
          </span>
        </p>
        <div className="flex flex-col">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            $
            {(user?.balance || 0) / 100
              ? ((user?.balance || 0) / 100).toFixed(2)
              : "0.00"}
          </h2>
          <p className="text-sm md:text-base font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            USh{" "}
            {user?.balance || 0
              ? Math.round(
                  ((user?.balance || 0) / 100) * USD_TO_UGX_EXCHANGE_RATE,
                ).toLocaleString()
              : "0"}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {user?.balance === 0 ? (
            <div className="flex items-center text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 w-fit px-3 py-1 rounded-full border border-red-100 dark:border-red-800">
              <AlertCircle size={14} className="mr-1" />
              <span>Balance Empty</span>
            </div>
          ) : (
            <div className="space-y-1">
              {/* <div className="flex items-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-green-100 dark:border-transparent mb-2">
                <TrendingUp size={14} className="mr-1" />
                <span>Auto-refill active</span>
              </div> */}
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Est. Capacity:{" "}
                <span className="text-slate-800 dark:text-slate-200">
                  ~{potentialTokens.toLocaleString()} tokens
                </span>
                <span className="mx-1 opacity-50">|</span>
                <span className="text-slate-800 dark:text-slate-200">
                  ~{potentialVoiceMins} mins voice
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text Tokens Tracker (Switches between Welcome and Daily) */}
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border transition-all duration-300 group relative overflow-hidden ${
          showTextWarning
            ? "border-red-500 bg-red-50/30 dark:bg-red-900/10 animate-flash"
            : "border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900"
        }`}
      >
        <div className="flex items-center justify-between mb-4 relative">
          <div
            className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${
              showTextWarning
                ? "bg-red-100 dark:bg-red-900/40 text-red-600"
                : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            }`}
          >
            {hasWelcomeTokens && !hasBalance ? (
              <Gift size={20} />
            ) : (
              <MessageSquareIcon size={20} />
            )}
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-wide ${showTextWarning ? "text-red-600" : "text-blue-600 dark:text-blue-400"}`}
          >
            {hasBalance
              ? "Available Tokens"
              : hasWelcomeTokens
                ? "Welcome Tokens"
                : hasFreeTextTokens
                  ? "Free Token"
                  : "No Credits"}
          </span>
        </div>

        <div className="relative">
          {hasBalance ? (
            // WALLET BALANCE MODE
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                ~{potentialTokens.toLocaleString()}
                <span className="text-sm font-medium text-slate-400">
                  tokens available
                </span>
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Calculation Breakdown
                </p>
                <div className="flex justify-between items-start text-xs text-slate-600 dark:text-slate-400">
                  <span>Current Wallet Balance</span>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      ${(balance / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {Math.round(
                        (balance / 100) * USD_TO_UGX_EXCHANGE_RATE,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-start text-xs text-slate-600 dark:text-slate-400">
                  <span>Cost per 1,000 Tokens</span>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      ${COST_PER_THOUSAND_TOKENS}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {(
                        COST_PER_THOUSAND_TOKENS * USD_TO_UGX_EXCHANGE_RATE
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>Estimated Total</span>
                  <span>~{potentialTokens.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : hasWelcomeTokens ? (
            // WELCOME MODE
            <>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                {welcomeTextTokens}{" "}
                <span className="text-sm font-medium text-slate-400">
                  / {FREE_WELCOME_TEXT_TOKENS} left
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(welcomeTextTokens / FREE_WELCOME_TEXT_TOKENS) * 100}%`,
                  }}
                ></div>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Welcome Reward: Usage stats active for this bundle.
              </p>
            </>
          ) : hasFreeTextTokens ? (
            // DAILY MODE
            <>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                {Math.floor(freeTextTokens)}{" "}
                <span className="text-sm font-medium text-slate-400">
                  / {FREE_TEXT_TOKENS} free
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(freeTextTokens / FREE_TEXT_TOKENS) * 100}%`,
                  }}
                ></div>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Resets every 5 days. Paid balance applied after exhaustion.
              </p>
            </>
          ) : (
            // EMPTY MODE WITH COUNTDOWN
            <AnimatePresence mode="wait">
              <motion.div
                key="countdown-container"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative mt-2"
              >
                <div className="bg-linear-to-br from-amber-500/5 to-orange-500/10 dark:from-amber-500/10 dark:to-orange-500/20 rounded-2xl p-4 border border-amber-200/50 dark:border-amber-500/20 overflow-hidden relative group">
                  {/* Decorative background glow */}
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 blur-3xl rounded-full group-hover:bg-amber-500/20 transition-all duration-700" />

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                      <Clock size={20} className="animate-pulse" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                        {isResetOverdue ? "Refreshing Credits..." : "Free Credits Pending"}
                        <Sparkles size={12} className="text-amber-500" />
                      </h4>
                      <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 leading-tight">
                        {isResetOverdue 
                          ? "Your tokens are arriving soon. Hang tight while we process your reward."
                          : <>Your 5-day cycle is active. <span className="font-bold text-amber-800 dark:text-amber-200">1,000 free tokens</span> will be credited in:</>}
                      </p>
                    </div>
                  </div>

                  {/* Countdown Timer Grid (Only show if not overdue) */}
                  {!isResetOverdue ? (
                    <div className="grid grid-cols-4 gap-2 mt-4 relative z-10">
                      {[
                        { label: "Days", value: timeLeft?.days ?? 0 },
                        { label: "Hrs", value: timeLeft?.hours ?? 0 },
                        { label: "Mins", value: timeLeft?.minutes ?? 0 },
                        { label: "Secs", value: timeLeft?.seconds ?? 0 },
                      ].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <div className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-lg py-2 border border-white dark:border-white/5 shadow-xs flex items-center justify-center">
                            <span className="text-lg font-black font-mono text-slate-800 dark:text-white tabular-nums">
                              {String(item.value).padStart(2, "0")}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1 tracking-wider">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col items-center justify-center py-4 bg-white/30 dark:bg-slate-900/30 rounded-xl border border-white/50 dark:border-white/5 backdrop-blur-sm relative overflow-hidden group">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm tracking-tight"
                      >
                        <Sparkles size={16} />
                        Arriving Soon
                      </motion.div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Processing reward batch...</p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                      <span>{isResetOverdue ? "Processing Reward" : "Cycle Progress"}</span>
                      <span className="text-amber-600 dark:text-amber-400">
                        {isResetOverdue ? "99%" : `${Math.round(progressPercent)}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: isResetOverdue ? "99%" : `${progressPercent}%`,
                          opacity: isResetOverdue ? [0.6, 1, 0.6] : 1
                        }}
                        transition={{ 
                          width: { duration: 1, ease: "easeOut" },
                          opacity: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                        }}
                        className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <CustomLink 
                      href="/dashboard/freecredits"
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 transition-colors uppercase tracking-widest"
                    >
                      <Sparkles size={10} />
                      View Reward History
                    </CustomLink>
                  </div>



                  {/* Call to Action: Fund Wallet */}
                  <div className="mt-5 p-3 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-white/60 dark:border-white/5 backdrop-blur-sm relative overflow-hidden group/cta transition-all hover:bg-white/60 dark:hover:bg-slate-900/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                          <Wallet size={14} />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-900 dark:text-white leading-none">
                            Don&apos;t want to wait?
                          </p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-none">
                            Fund your wallet to continue now.
                          </p>
                        </div>
                      </div>
                      <CustomLink
                        href="/dashboard/billing"
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all transform hover:scale-110 active:scale-95 shadow-lg shadow-blue-500/20"
                      >
                        <ArrowRight size={14} />
                      </CustomLink>
                    </div>
                  </div>

                  <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 mt-3 italic">
                    Credits are refreshed every 120 hours for active users.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Voice Tracker */}
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border transition-all duration-300 group relative overflow-hidden ${
          showVoiceWarning
            ? "border-orange-500 bg-orange-50/30 dark:bg-orange-900/10 animate-flash"
            : "border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-900"
        }`}
      >
        <div className="flex items-center justify-between mb-4 relative">
          <div
            className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${
              showVoiceWarning
                ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600"
                : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
            }`}
          >
            <MicIcon size={20} />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-wide ${showVoiceWarning ? "text-orange-600" : "text-purple-600 dark:text-purple-400"}`}
          >
            {hasBalance ? "Voice Minutes" : "Voice Bonus"}
          </span>
        </div>

        <div className="relative">
          {hasBalance ? (
            // PAID VOICE MODE
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                {potentialVoiceMins}
                <span className="text-sm font-medium text-slate-400">
                  mins available
                </span>
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Wallet Breakdown
                </p>
                <div className="flex justify-between items-start text-xs text-slate-600 dark:text-slate-400">
                  <span>Balance</span>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      ${(balance / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {Math.round(
                        (balance / 100) * USD_TO_UGX_EXCHANGE_RATE,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-start text-xs text-slate-600 dark:text-slate-400">
                  <span>Rate / Minute</span>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      ${COST_PER_VOICE_MINUTE}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {(
                        COST_PER_VOICE_MINUTE * USD_TO_UGX_EXCHANGE_RATE
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
                  <span>Total Mins</span>
                  <span>{potentialVoiceMins}m</span>
                </div>
              </div>
            </div>
          ) : hasFreeVoiceSeconds ? (
            // FREE VOICE MODE
            <>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                {Math.ceil(freeVoiceSeconds)}{" "}
                <span className="text-sm font-medium text-slate-400">
                  sec left
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(freeVoiceSeconds / FREE_WELCOME_VOICE_SECONDS) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>Welcome Gift</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  (~ {(freeVoiceSeconds / 60).toFixed(1)} mins)
                </span>
              </p>
            </>
          ) : (
            // EMPTY VOICE MODE
            <div className="py-2">
              <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                0 Seconds
              </h3>
              <div className="flex items-center gap-2 mt-3 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-600 dark:text-orange-400">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">
                  Voice credits depleted. Please re-charge your wallet to
                  continue consultations.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsageCards;
