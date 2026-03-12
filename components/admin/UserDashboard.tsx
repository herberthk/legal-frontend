"use client";
import {
  DAILY_FREE_TOKENS,
  generateMockVoiceSessions,
  generateUserTransactions,
  voices,
  WELCOME_BONUS_TOKENS,
  WELCOME_BONUS_VOICE_SECONDS,
} from "@/constants";
import { useAppStore, useThemeStore } from "@/store";
import {
  PlusCircle,
  Scale,
  AlertCircle,
  TrendingUp,
  Gift,
  MessageSquareIcon,
  MicIcon,
  Mic,
  Check,
  DollarSign,
  FileTextIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trash2,
  Activity,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  BarChart,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { formatDuration } from "@/lib";
import { updateUserVoicePreference } from "@/lib";
import { toast } from "sonner";
import UsageHistory from "./UsageHistory";

const UserDashboard = () => {
  const user = useAuthStore((state) => state.user)!;
  const isDark = useThemeStore((state) => state.theme);
  const tokenHistory = useAppStore((state) => state.tokenUsageHistory);
  // --- Voice Sessions State ---
  const voiceSessions = useAppStore((state) => state.voiceSessions);

  const setUser = useAuthStore((state) => state.setUser);

  const [transactions, setTransactions] = useState<Transaction[]>(
    generateUserTransactions(20),
  );

  // Transaction Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Voice Session Pagination
  const [voicePage, setVoicePage] = useState(1);
  const voiceItemsPerPage = 4;

  const usageStats = useMemo(() => {
    const textTokens = tokenHistory
      .filter((r) => r.unit === "TOKENS")
      .reduce((sum, r) => sum + r.amount, 0);

    const voiceSeconds = tokenHistory
      .filter((r) => r.unit === "SECONDS")
      .reduce((sum, r) => sum + r.amount, 0);

    // Convert seconds to minutes for display
    const voiceMinutes = parseFloat((voiceSeconds / 60).toFixed(2));

    // Simple mock projection for chart based on real values
    const currentDay = new Date().toLocaleDateString(undefined, {
      weekday: "short",
    });
    const chartData = [
      { name: "Mon", text: 450, voice: 2 },
      { name: "Tue", text: 800, voice: 5 },
      { name: "Wed", text: 200, voice: 10 },
      { name: "Thu", text: 600, voice: 0 },
      { name: "Fri", text: 1100, voice: 15 },
      { name: "Sat", text: 300, voice: 0 },
      { name: currentDay, text: textTokens, voice: voiceMinutes }, // Include real usage
    ];

    return { textTokens, voiceMinutes, chartData };
  }, [tokenHistory]);

  // Transaction Pagination Logic
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const currentTransactions = transactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Voice Pagination Logic
  const totalVoicePages = Math.ceil(voiceSessions.length / voiceItemsPerPage);
  const currentVoiceSessions = voiceSessions.slice(
    (voicePage - 1) * voiceItemsPerPage,
    voicePage * voiceItemsPerPage,
  );

  // --- Limits Logic ---
  // If Welcome Tokens > 0, we show Welcome Bonus Card.
  // If Welcome Tokens == 0, we show Daily Limit Card.
  const isWelcomeActive = user?.welcomeTextTokens > 0;
  const isWelcomeTextEmpty = user?.welcomeTextTokens === 0;
  const isDailyTextEmpty = user?.freeTextTokens === 0;

  // Total Capacities for reference
  const WELCOME_CAP = 4000;
  const DAILY_CAP = 1000;

  // Voice limit is static 300s welcome bonus
  const voiceLimit = 300;
  const isVoiceEmpty = user?.freeVoiceSeconds === 0;

  // Wallet Equivalence
  // Text: $0.03 per 1000 tokens
  // Voice: $0.05 per minute
  const potentialTokens = Math.floor((user?.balance / 0.03) * 1000);
  const potentialVoiceMins = Math.floor(user?.balance / 0.05);

  const updateVoice = async (voiceName: string) => {
    try {
      const result = await updateUserVoicePreference(voiceName, user.id);
      if (result.success) {
        toast.success(result.message, {
          style: {
            background: "#22c55e",
            color: "#fff",
          },
        });
        setUser({
          ...user,
          voicePreference: voiceName,
        });
      } else {
        toast.error(result.message, {
          style: {
            background: "#ef4444",
            color: "#fff",
          },
        });
      }
    } catch (error) {
      toast.error("Failed to update voice preference", {
        style: {
          background: "#ef4444",
          color: "#fff",
        },
      });
    }
  };
  console.log("User", user);
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            My Dashboard
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2">
            Track your daily free credits and account balance.
          </p>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95">
          <PlusCircle size={18} />
          <span>Add Funds</span>
        </button>
      </div>

      {/* Balance & Usage Cards */}
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
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            ${user?.balance ? user?.balance.toFixed(2) : "0.00"}
          </h2>

          <div className="mt-6 flex flex-col gap-2">
            {(user?.balance ?? 0 < 0.05) ? (
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
          className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border transition-all duration-300 group relative overflow-hidden ${!isWelcomeActive && isDailyTextEmpty ? "border-red-200 dark:border-red-900/50" : "border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-900"}`}
        >
          <div className="flex items-center justify-between mb-4 relative">
            <div
              className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${!isWelcomeActive && isDailyTextEmpty ? "bg-red-50 dark:bg-red-900/20 text-red-500" : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}
            >
              {isWelcomeActive ? (
                <Gift size={20} />
              ) : (
                <MessageSquareIcon size={20} />
              )}
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wide ${!isWelcomeActive && isDailyTextEmpty ? "text-red-500" : "text-blue-600 dark:text-blue-400"}`}
            >
              {isWelcomeActive ? "Welcome Bundle" : "Daily Limit"}
            </span>
          </div>

          <div className="relative">
            {isWelcomeActive ? (
              // WELCOME MODE
              <>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                  {user?.welcomeTextTokens}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    / {WELCOME_CAP} left
                  </span>
                </h3>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${(user?.welcomeTextTokens ?? 0 / WELCOME_CAP) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  One-time bonus. Daily limit applies after this is fully
                  consumed.
                </p>
              </>
            ) : // DAILY MODE (Or Empty)
            isDailyTextEmpty ? (
              <>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-baseline gap-1">
                  {DAILY_CAP}/{DAILY_CAP}{" "}
                  <span className="text-sm font-medium opacity-80">
                    Consumed
                  </span>
                </h3>
                <div className="w-full h-2 bg-red-100 dark:bg-red-900/30 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full w-full"></div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-red-600 dark:text-red-400 animate-pulse">
                  <AlertCircle size={12} />
                  Please fund your wallet
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                  {Math.floor(user?.freeTextTokens ?? 0)}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    / {DAILY_CAP} free
                  </span>
                </h3>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${(user?.freeTextTokens ?? 0 / DAILY_CAP) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Resets every 24 hours. Using paid balance if exceeded.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Voice Tracker */}
        <div
          className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border transition-all duration-300 group relative overflow-hidden ${isVoiceEmpty ? "border-red-200 dark:border-red-900/50" : "border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-900"}`}
        >
          <div className="flex items-center justify-between mb-4 relative">
            <div
              className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${isVoiceEmpty ? "bg-red-50 dark:bg-red-900/20 text-red-500" : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"}`}
            >
              <MicIcon size={20} />
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-wide ${isVoiceEmpty ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}
            >
              Voice Bonus
            </span>
          </div>

          <div className="relative">
            {isVoiceEmpty ? (
              <>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-baseline gap-1">
                  {voiceLimit}/{voiceLimit}s{" "}
                  <span className="text-sm font-medium opacity-80">
                    Consumed
                  </span>
                </h3>
                <div className="w-full h-2 bg-red-100 dark:bg-red-900/30 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full w-full"></div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-red-600 dark:text-red-400 animate-pulse">
                  <AlertCircle size={12} />
                  Please fund your wallet
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                  {Math.ceil(user?.freeVoiceSeconds ?? 0)}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    sec left
                  </span>
                </h3>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${(user?.freeVoiceSeconds ?? 0 / voiceLimit) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-2 flex justify-between">
                  <span>One-time welcome gift</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    (~ {(user?.freeVoiceSeconds ?? 0 / 60).toFixed(1)} mins)
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Voice Selection */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg">
            <Mic size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              AI Voice Persona
            </h3>
            <p className="text-xs text-slate-500">
              Select the voice for your live legal consultations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {voices.map((voice) => (
            <button
              key={voice.id}
              onClick={() => updateVoice(voice.name)}
              className={`relative p-3 rounded-xl border text-left transition-all duration-300 hover:shadow-md ${
                user?.voicePreference === voice.name
                  ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-500"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                    voice.gender === "Female"
                      ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {voice.gender}
                </span>
                {user?.voicePreference === voice.name && (
                  <Check
                    size={16}
                    className="text-orange-600 dark:text-orange-500"
                  />
                )}
              </div>
              <p className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">
                {voice.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {voice.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Token Usage History */}
      <UsageHistory userId={user?.id} />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Usage Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Usage Breakdown (Weekly)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={usageStats.chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? "#334155" : "#e2e8f0"}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#3b82f6"
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
                  label={{
                    value: "Tokens",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#3b82f6",
                    fontSize: 10,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#8b5cf6"
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b" }}
                  label={{
                    value: "Minutes",
                    angle: 90,
                    position: "insideRight",
                    fill: "#8b5cf6",
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }}
                  contentStyle={{
                    backgroundColor: isDark ? "#1e293b" : "#fff",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    color: isDark ? "#fff" : "#000",
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="text"
                  name="Text (Tokens)"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  yAxisId="right"
                  dataKey="voice"
                  name="Voice (Mins)"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col hover:shadow-lg transition-all duration-300">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {currentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors duration-200 cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-full transition-colors ${
                      tx.type === "DEPOSIT"
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : tx.type === "VOICE_SESSION"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {tx.type === "DEPOSIT" ? (
                      <DollarSign size={16} />
                    ) : tx.type === "VOICE_SESSION" ? (
                      <MicIcon size={16} />
                    ) : (
                      <FileTextIcon size={16} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {tx.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tx.date} • {tx.details}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono text-sm font-medium ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300"}`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft
                size={20}
                className="text-slate-600 dark:text-slate-400"
              />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages })
                .slice(0, 5)
                .map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-6 h-6 rounded text-xs flex items-center justify-center transition-colors ${currentPage === i + 1 ? "bg-orange-500 text-white" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"}`}
                  >
                    {i + 1}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <ChevronRight
                size={20}
                className="text-slate-600 dark:text-slate-400"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Consultations Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mt-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Recorded Voice Consultations
            </h3>
            <p className="text-xs text-slate-500">
              Playback your recent session recordings.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {voiceSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm italic border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
              No recorded sessions available. Start a voice chat to see records
              here.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentVoiceSessions.map((session) => (
                  <div
                    key={session.id}
                    className="group relative bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all hover:border-orange-500/20 dark:hover:border-orange-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {/* Header with Icon and Date */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 p-2.5 rounded-xl">
                          <Mic size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            Legal Consultation
                          </h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(session.date).toLocaleDateString()} •{" "}
                            {new Date(session.date).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {}}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100"
                        title="Delete Recording"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Context Preview */}
                    <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2">
                        &quot;{session.previewText}&quot;
                      </p>
                    </div>

                    {/* Audio Player */}
                    <div className="mt-2">
                      <audio
                        controls
                        src={session.audioUrl}
                        className="w-full h-8 [&::-webkit-media-controls-panel]:bg-slate-100 dark:[&::-webkit-media-controls-panel]:bg-slate-700 rounded-lg"
                      />
                      <div className="flex justify-between mt-1 px-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Duration: {formatDuration(session.duration)}
                        </span>
                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                          Voice & AI Audio
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Voice Pagination Controls */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 rounded-lg p-3">
                <span className="text-xs text-slate-500">
                  Page {voicePage} of {Math.max(1, totalVoicePages)}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setVoicePage((p) => Math.max(1, p - 1))}
                    disabled={voicePage === 1}
                    className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                  >
                    <ChevronLeft
                      size={20}
                      className="text-slate-600 dark:text-slate-400"
                    />
                  </button>
                  <button
                    onClick={() =>
                      setVoicePage((p) => Math.min(totalVoicePages, p + 1))
                    }
                    disabled={
                      voicePage === totalVoicePages || totalVoicePages === 0
                    }
                    className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                  >
                    <ChevronRight
                      size={20}
                      className="text-slate-600 dark:text-slate-400"
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent System Activity Placeholder */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm mt-8">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Latest System Events
        </h3>
        <div className="space-y-4">
          {tokenHistory
            .slice(-3)
            .reverse()
            .map((rec, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors animate-in fade-in slide-in-from-left-2"
              >
                <div
                  className={`w-2 h-2 rounded-full ${rec.unit === "TOKENS" ? "bg-blue-500" : "bg-purple-500"}`}
                ></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Usage Recorded
                  </p>
                  <p className="text-xs text-slate-500">
                    {rec.amount} {rec.unit.toLowerCase()} •{" "}
                    {rec.type.replace("_", " ")}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(rec.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          {tokenHistory.length === 0 && (
            <div className="flex items-center gap-4 p-3 rounded-lg opacity-50">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  System Ready
                </p>
                <p className="text-xs text-slate-500">
                  Waiting for first chat session...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
