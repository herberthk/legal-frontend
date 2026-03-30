import {
  USD_TO_UGX_EXCHANGE_RATE,
  COST_PER_THOUSAND_TOKENS,
  FREE_WELCOME_TEXT_TOKENS,
  FREE_DAILY_TEXT_TOKENS,
  COST_PER_VOICE_MINUTE,
  FREE_WELCOME_VOICE_SECONDS,
} from "@/constants";
import {
  Scale,
  AlertCircle,
  TrendingUp,
  Gift,
  MessageSquareIcon,
  MicIcon,
} from "lucide-react";
import { FC } from "react";

type Prop = {
  user: User;
};

const UsageCards: FC<Prop> = ({ user }) => {
  // --- Limits Logic ---
  const hasBalance = (user?.balance ?? 0) > 0;
  const hasWelcomeTokens = (user?.welcomeTextTokens ?? 0) > 0;
  const hasFreeTextTokens = (user?.freeTextTokens ?? 0) > 0;
  const hasFreeVoiceSeconds = (user?.freeVoiceSeconds ?? 0) > 0;

  const showTextWarning =
    !hasBalance && !hasWelcomeTokens && !hasFreeTextTokens;
  const showVoiceWarning = !hasBalance && !hasFreeVoiceSeconds;

  // Wallet Equivalence
  // Text: $0.027 per 1000 tokens
  // Voice: $0.08 per minute
  const potentialTokens = Math.floor(
    ((user?.balance || 0) / 100 / COST_PER_THOUSAND_TOKENS) * 1000,
  );
  const potentialVoiceMins = Math.floor(
    (user?.balance || 0) / 100 / COST_PER_VOICE_MINUTE,
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Main Balance */}
      <div className="bg-white dark:bg-linear-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-xl border border-slate-100 dark:border-transparent relative overflow-hidden group hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
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
              <div className="flex items-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-green-100 dark:border-transparent mb-2">
                <TrendingUp size={14} className="mr-1" />
                <span>Auto-refill active</span>
              </div>
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
                      ${((user?.balance || 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {Math.round(
                        ((user?.balance || 0) / 100) * USD_TO_UGX_EXCHANGE_RATE,
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
                {user?.welcomeTextTokens}{" "}
                <span className="text-sm font-medium text-slate-400">
                  / {FREE_WELCOME_TEXT_TOKENS} left
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(user?.welcomeTextTokens / FREE_WELCOME_TEXT_TOKENS) * 100}%`,
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
                {Math.floor(user?.freeTextTokens ?? 0)}{" "}
                <span className="text-sm font-medium text-slate-400">
                  / {FREE_DAILY_TEXT_TOKENS} free
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(user?.freeTextTokens / FREE_DAILY_TEXT_TOKENS) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Resets daily. Paid balance applied after exhaustion.
              </p>
            </>
          ) : (
            // EMPTY MODE
            <div className="py-2">
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                0 Tokens
              </h3>
              <div className="flex items-center gap-2 mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-600 dark:text-red-400">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold leading-tight">
                  Your balance and free credits are exhausted. Please fund your
                  wallet to continue.
                </p>
              </div>
            </div>
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
                      ${((user?.balance || 0) / 100).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      USh{" "}
                      {Math.round(
                        ((user?.balance || 0) / 100) * USD_TO_UGX_EXCHANGE_RATE,
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
                {Math.ceil(user?.freeVoiceSeconds ?? 0)}{" "}
                <span className="text-sm font-medium text-slate-400">
                  sec left
                </span>
              </h3>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(user?.freeVoiceSeconds / FREE_WELCOME_VOICE_SECONDS) * 100}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>Welcome Gift</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  (~ {(user?.freeVoiceSeconds / 60).toFixed(1)} mins)
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
